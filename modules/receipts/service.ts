import "server-only";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/permissions";
import { receiptInput } from "@/lib/validation";
import { receiptSnapshot } from "@/modules/business-rules";

export async function createReceipt(input: unknown, user: { id: string; role: UserRole }) {
  assertPermission(user.role, "receipt:create");
  const data = receiptInput.parse(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [service] = await tx.$queryRaw<{ id: string; name: string; price: Prisma.Decimal }[]>`
          SELECT s.id, s.name, s.price
          FROM "Service" s
          INNER JOIN "PaymentMethod" pm
            ON pm.id = ${data.paymentMethodId} AND pm."isActive" = true
          WHERE s.id = ${data.serviceId} AND s."isActive" = true
          LIMIT 1
        `;
        if (!service) throw new Error("SERVICE_OR_PAYMENT_UNAVAILABLE");
        const receipt = await tx.receipt.create({ data: receiptSnapshot(service, data, user.id) });
        await tx.auditLog.create({
          data: { userId: user.id, action: "RECEIPT_CREATED", entityType: "Receipt", entityId: String(receipt.id), newValues: { serviceId: service.id, amount: service.price.toFixed(2) } },
        });
        return receipt;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.receipt.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
        if (existing?.createdByUserId === user.id) return existing;
      }
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2)) throw error;
    }
  }
  throw new Error("RECEIPT_RETRY_EXHAUSTED");
}

export async function cancelReceipt(id: number, reason: string, user: { id: string; role: UserRole }) {
  assertPermission(user.role, "receipt:cancel");
  return prisma.$transaction(async (tx) => {
    const current = await tx.receipt.findUnique({ where: { id } });
    if (!current || current.status === "CANCELLED") throw new Error("RECEIPT_NOT_CANCELLABLE");
    const updated = await tx.receipt.update({
      where: { id },
      data: { status: "CANCELLED", cancellationReason: reason, cancelledAt: new Date(), cancelledByUserId: user.id },
    });
    await tx.auditLog.create({
      data: { userId: user.id, action: "RECEIPT_CANCELLED", entityType: "Receipt", entityId: String(id), oldValues: { status: current.status }, newValues: { status: updated.status, reason } },
    });
    return updated;
  });
}

export async function recordReprint(id: number, user: { id: string; role: UserRole }) {
  assertPermission(user.role, "receipt:reprint");
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findUnique({ where: { id } });
    if (!receipt) throw new Error("RECEIPT_NOT_FOUND");
    if (user.role === "SUPERVISOR" && receipt.createdByUserId !== user.id) throw new Error("FORBIDDEN");
    const updated = await tx.receipt.update({ where: { id }, data: { printCount: { increment: 1 } } });
    await tx.receiptReprint.create({ data: { receiptId: id, userId: user.id } });
    await tx.auditLog.create({ data: { userId: user.id, action: "RECEIPT_REPRINTED", entityType: "Receipt", entityId: String(id), newValues: { printCount: updated.printCount } } });
    return updated;
  });
}
