import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { purchaseInput } from "@/lib/validation";

export async function createPurchase(input: unknown, adminId: string) {
  const data = purchaseInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({ data: { supplierId: data.supplierId, paymentMethodId: data.paymentMethodId, supplierInvoiceNumber: data.supplierInvoiceNumber, purchaseDate: data.purchaseDate, paymentStatus: data.paymentStatus, notes: data.notes, createdByUserId: adminId } });
    await tx.purchaseItem.create({ data: { purchaseId: purchase.id, inventoryItemId: data.inventoryItemId, quantity: new Prisma.Decimal(data.quantity), unitCost: new Prisma.Decimal(data.unitCost) } });
    await tx.auditLog.create({ data: { userId: adminId, action: "PURCHASE_CREATED", entityType: "Purchase", entityId: purchase.id } });
    return purchase;
  });
}

export async function receivePurchase(id: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
    if (!purchase || purchase.status !== "DRAFT" || !purchase.items.length) throw new Error("PURCHASE_NOT_RECEIVABLE");
    const changed = await tx.purchase.updateMany({ where: { id, status: "DRAFT" }, data: { status: "RECEIVED" } });
    if (changed.count !== 1) throw new Error("PURCHASE_ALREADY_RECEIVED");
    await tx.inventoryMovement.createMany({ data: purchase.items.map((item) => ({ inventoryItemId: item.inventoryItemId, movementType: "PURCHASE_IN" as const, quantity: item.quantity, purchaseItemId: item.id, createdByUserId: adminId })) });
    await tx.auditLog.create({ data: { userId: adminId, action: "PURCHASE_RECEIVED", entityType: "Purchase", entityId: id } });
    return purchase;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
