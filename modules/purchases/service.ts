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

function purchaseSnapshot(purchase: { supplierId: string; supplierInvoiceNumber: string | null; purchaseDate: Date; paymentStatus: string; status: string; items: { inventoryItemId: string; quantity: Prisma.Decimal; unitCost: Prisma.Decimal }[] }) {
  return {
    supplierId: purchase.supplierId,
    supplierInvoiceNumber: purchase.supplierInvoiceNumber,
    purchaseDate: purchase.purchaseDate.toISOString(),
    paymentStatus: purchase.paymentStatus,
    status: purchase.status,
    items: purchase.items.map((item) => ({ inventoryItemId: item.inventoryItemId, quantity: item.quantity.toString(), unitCost: item.unitCost.toFixed(2) })),
  };
}

export async function updatePurchase(id: string, input: unknown, adminId: string) {
  const data = purchaseInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const current = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
    if (!current) throw new Error("PURCHASE_NOT_FOUND");
    if (current.status !== "DRAFT") throw new Error("PURCHASE_NOT_EDITABLE");
    const changed = await tx.purchase.updateMany({
      where: { id, status: "DRAFT" },
      data: { supplierId: data.supplierId, paymentMethodId: data.paymentMethodId ?? null, supplierInvoiceNumber: data.supplierInvoiceNumber ?? null, purchaseDate: data.purchaseDate, paymentStatus: data.paymentStatus, notes: data.notes ?? null },
    });
    if (changed.count !== 1) throw new Error("PURCHASE_NOT_EDITABLE");
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
    await tx.purchaseItem.create({ data: { purchaseId: id, inventoryItemId: data.inventoryItemId, quantity: new Prisma.Decimal(data.quantity), unitCost: new Prisma.Decimal(data.unitCost) } });
    const purchase = await tx.purchase.findUniqueOrThrow({ where: { id }, include: { items: true } });
    await tx.auditLog.create({ data: { userId: adminId, action: "PURCHASE_UPDATED", entityType: "Purchase", entityId: id, oldValues: purchaseSnapshot(current), newValues: purchaseSnapshot(purchase) } });
    return purchase;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function deletePurchase(id: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
    if (!current) throw new Error("PURCHASE_NOT_FOUND");
    if (current.status !== "DRAFT") throw new Error("PURCHASE_NOT_DELETABLE");
    await tx.auditLog.create({ data: { userId: adminId, action: "PURCHASE_DELETED", entityType: "Purchase", entityId: id, oldValues: purchaseSnapshot(current) } });
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
    await tx.purchase.delete({ where: { id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
