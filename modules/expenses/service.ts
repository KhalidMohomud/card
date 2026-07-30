import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expenseInput } from "@/lib/validation";
import { calculateCommission } from "@/modules/business-rules";

export function commissionAmount(carCount: number, ratePerCar: string) {
  return calculateCommission(carCount, ratePerCar);
}

type ExpenseData = ReturnType<typeof expenseInput.parse>;

async function prepareExpense(data: ExpenseData) {
  let amount: Prisma.Decimal;
  let receiptCount: number | undefined;
  if (data.type === "WORKER_COMMISSION") {
    if (!data.supervisorUserId || !data.carCount || !data.ratePerCar) throw new Error("COMMISSION_FIELDS_REQUIRED");
    amount = commissionAmount(data.carCount, data.ratePerCar);
    const start = new Date(data.expenseDate); start.setHours(0, 0, 0, 0);
    const end = new Date(data.expenseDate); end.setHours(23, 59, 59, 999);
    receiptCount = await prisma.receipt.count({ where: { createdByUserId: data.supervisorUserId, status: "COMPLETED", issuedAt: { gte: start, lte: end } } });
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
  const { amount, receiptCount, values } = await prepareExpense(data);

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        ...values,
        createdByUserId: adminId,
      },
    });
    await tx.auditLog.create({ data: { userId: adminId, action: "EXPENSE_CREATED", entityType: "Expense", entityId: expense.id, newValues: { type: expense.type, amount: amount.toFixed(2), receiptCount } } });
    return expense;
  });
}

export async function updateExpense(id: string, input: unknown, adminId: string) {
  const data = expenseInput.parse(input);
  const { receiptCount, values } = await prepareExpense(data);
  return prisma.$transaction(async (tx) => {
    const current = await tx.expense.findUnique({ where: { id } });
    if (!current) throw new Error("EXPENSE_NOT_FOUND");
    if (current.status !== "ACTIVE") throw new Error("EXPENSE_NOT_EDITABLE");
    const changed = await tx.expense.updateMany({ where: { id, status: "ACTIVE" }, data: values });
    if (changed.count !== 1) throw new Error("EXPENSE_NOT_EDITABLE");
    const expense = await tx.expense.findUniqueOrThrow({ where: { id } });
    await tx.auditLog.create({ data: { userId: adminId, action: "EXPENSE_UPDATED", entityType: "Expense", entityId: id, oldValues: expenseSnapshot(current), newValues: { ...expenseSnapshot(expense), receiptCount } } });
    return expense;
  });
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
  if (reason.trim().length < 5) throw new Error("REASON_REQUIRED");
  return prisma.$transaction(async (tx) => {
    const current = await tx.expense.findUnique({ where: { id } });
    if (!current || current.status === "CANCELLED") throw new Error("EXPENSE_NOT_CANCELLABLE");
    const expense = await tx.expense.update({ where: { id }, data: { status: "CANCELLED", cancellationReason: reason.trim(), cancelledAt: new Date(), cancelledByUserId: adminId } });
    await tx.auditLog.create({ data: { userId: adminId, action: "EXPENSE_CANCELLED", entityType: "Expense", entityId: id, oldValues: { status: current.status }, newValues: { status: expense.status, reason } } });
    return expense;
  });
}
