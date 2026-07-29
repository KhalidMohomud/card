import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expenseInput } from "@/lib/validation";
import { calculateCommission } from "@/modules/business-rules";

export function commissionAmount(carCount: number, ratePerCar: string) {
  return calculateCommission(carCount, ratePerCar);
}

export async function createExpense(input: unknown, adminId: string) {
  const data = expenseInput.parse(input);
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

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        type: data.type, categoryId: data.categoryId, supervisorUserId: data.supervisorUserId,
        paymentMethodId: data.paymentMethodId, title: data.title, expenseDate: data.expenseDate,
        periodStart: data.periodStart, periodEnd: data.periodEnd, carCount: data.carCount,
        ratePerCar: data.ratePerCar ? new Prisma.Decimal(data.ratePerCar) : undefined, amount,
        paymentStatus: data.paymentStatus, paymentReference: data.paymentReference, notes: data.notes,
        commissionOverrideReason: data.overrideReason, createdByUserId: adminId,
      },
    });
    await tx.auditLog.create({ data: { userId: adminId, action: "EXPENSE_CREATED", entityType: "Expense", entityId: expense.id, newValues: { type: expense.type, amount: amount.toFixed(2), receiptCount } } });
    return expense;
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
