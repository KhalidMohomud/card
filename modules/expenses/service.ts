import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expenseInput } from "@/lib/validation";
import { calculateCommission } from "@/modules/business-rules";
import { businessDateEnd, businessDateInputValue, businessDateStart } from "@/lib/dates";

export function commissionAmount(carCount: number, ratePerCar: string) {
  return calculateCommission(carCount, ratePerCar);
}

type ExpenseData = ReturnType<typeof expenseInput.parse>;

async function prepareExpense(data: ExpenseData, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const [category, supervisor, paymentMethod] = await Promise.all([
    data.type === "GENERAL" && data.categoryId
      ? db.expenseCategory.findFirst({ where: { id: data.categoryId, isActive: true }, select: { id: true } })
      : null,
    data.type !== "GENERAL" && data.supervisorUserId
      ? db.user.findFirst({ where: { id: data.supervisorUserId, role: "SUPERVISOR", isActive: true }, select: { id: true } })
      : null,
    data.paymentMethodId
      ? db.paymentMethod.findFirst({ where: { id: data.paymentMethodId, isActive: true }, select: { id: true } })
      : null,
  ]);
  if (data.type === "GENERAL" && !category) throw new Error("CATEGORY_UNAVAILABLE");
  if (data.type !== "GENERAL" && !supervisor) throw new Error("SUPERVISOR_UNAVAILABLE");
  if (data.paymentMethodId && !paymentMethod) throw new Error("PAYMENT_METHOD_UNAVAILABLE");
  if (data.periodStart && data.periodEnd && data.periodStart > data.periodEnd) throw new Error("INVALID_SALARY_PERIOD");

  let amount: Prisma.Decimal;
  let receiptCount: number | undefined;
  if (data.type === "WORKER_COMMISSION") {
    if (!data.supervisorUserId || !data.carCount || !data.ratePerCar) throw new Error("COMMISSION_FIELDS_REQUIRED");
    amount = commissionAmount(data.carCount, data.ratePerCar);
    const businessDate = businessDateInputValue(data.expenseDate);
    const start = businessDateStart(businessDate);
    const end = businessDateEnd(businessDate);
    receiptCount = await db.receipt.count({ where: { createdByUserId: data.supervisorUserId, status: "COMPLETED", issuedAt: { gte: start, lte: end } } });
    if (data.carCount > receiptCount && !data.overrideReason) throw new Error(`OVERRIDE_REQUIRED:${receiptCount}`);
  } else {
    if (!data.amount) throw new Error("AMOUNT_REQUIRED");
    amount = new Prisma.Decimal(data.amount);
  }
  if (data.type === "GENERAL" && !data.categoryId) throw new Error("CATEGORY_REQUIRED");
  if (data.type === "SUPERVISOR_SALARY" && !data.supervisorUserId) throw new Error("SUPERVISOR_REQUIRED");

  return {
    amount,
    receiptCount,
    values: {
      type: data.type,
      categoryId: data.type === "GENERAL" ? data.categoryId : null,
      supervisorUserId: data.type === "GENERAL" ? null : data.supervisorUserId,
      paymentMethodId: data.paymentMethodId ?? null,
      title: data.title,
      expenseDate: data.expenseDate,
      periodStart: data.type === "SUPERVISOR_SALARY" ? data.periodStart ?? null : null,
      periodEnd: data.type === "SUPERVISOR_SALARY" ? data.periodEnd ?? null : null,
      carCount: data.type === "WORKER_COMMISSION" ? data.carCount : null,
      ratePerCar: data.type === "WORKER_COMMISSION" && data.ratePerCar ? new Prisma.Decimal(data.ratePerCar) : null,
      amount,
      paymentStatus: data.paymentStatus,
      paymentReference: data.paymentReference ?? null,
      notes: data.notes ?? null,
      commissionOverrideReason: data.type === "WORKER_COMMISSION" ? data.overrideReason ?? null : null,
    },
  };
}

function expenseSnapshot(expense: { type: string; title: string; amount: Prisma.Decimal; expenseDate: Date; status: string }) {
  return { type: expense.type, title: expense.title, amount: expense.amount.toFixed(2), expenseDate: expense.expenseDate.toISOString(), status: expense.status };
}

export async function createExpense(input: unknown, adminId: string) {
  const data = expenseInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const { amount, receiptCount, values } = await prepareExpense(data, tx);
    const expense = await tx.expense.create({
      data: {
        ...values,
        createdByUserId: adminId,
      },
    });
    await tx.auditLog.create({ data: { userId: adminId, action: "EXPENSE_CREATED", entityType: "Expense", entityId: expense.id, newValues: { type: expense.type, amount: amount.toFixed(2), receiptCount } } });
    return expense;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateExpense(id: string, input: unknown, adminId: string) {
  const data = expenseInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const { receiptCount, values } = await prepareExpense(data, tx);
    const current = await tx.expense.findUnique({ where: { id } });
    if (!current) throw new Error("EXPENSE_NOT_FOUND");
    if (current.status !== "ACTIVE") throw new Error("EXPENSE_NOT_EDITABLE");
    const changed = await tx.expense.updateMany({ where: { id, status: "ACTIVE" }, data: values });
    if (changed.count !== 1) throw new Error("EXPENSE_NOT_EDITABLE");
    const expense = await tx.expense.findUniqueOrThrow({ where: { id } });
    await tx.auditLog.create({ data: { userId: adminId, action: "EXPENSE_UPDATED", entityType: "Expense", entityId: id, oldValues: expenseSnapshot(current), newValues: { ...expenseSnapshot(expense), receiptCount } } });
    return expense;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function deleteExpense(id: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.expense.findUnique({ where: { id } });
    if (!current) throw new Error("EXPENSE_NOT_FOUND");
    await tx.auditLog.create({ data: { userId: adminId, action: "EXPENSE_DELETED", entityType: "Expense", entityId: id, oldValues: expenseSnapshot(current) } });
    await tx.expense.delete({ where: { id } });
  });
}

export async function cancelExpense(id: string, reason: string, adminId: string) {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 5 || normalizedReason.length > 500) throw new Error("REASON_REQUIRED");
  return prisma.$transaction(async (tx) => {
    const current = await tx.expense.findUnique({ where: { id } });
    if (!current || current.status === "CANCELLED") throw new Error("EXPENSE_NOT_CANCELLABLE");
    const changed = await tx.expense.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "CANCELLED", cancellationReason: normalizedReason, cancelledAt: new Date(), cancelledByUserId: adminId } });
    if (changed.count !== 1) throw new Error("EXPENSE_NOT_CANCELLABLE");
    const expense = await tx.expense.findUniqueOrThrow({ where: { id } });
    await tx.auditLog.create({ data: { userId: adminId, action: "EXPENSE_CANCELLED", entityType: "Expense", entityId: id, oldValues: { status: current.status }, newValues: { status: expense.status, reason: normalizedReason } } });
    return expense;
  });
}
