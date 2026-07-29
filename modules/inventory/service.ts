import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adjustmentInput, issueCloseInput, issueInput } from "@/lib/validation";
import { getStock } from "@/modules/inventory/stock";

export async function issueInventory(input: unknown, adminId: string) {
  const data = issueInput.parse(input);
  const quantity = new Prisma.Decimal(data.quantity);
  return prisma.$transaction(async (tx) => {
    const [item, supervisor] = await Promise.all([
      tx.inventoryItem.findFirst({ where: { id: data.inventoryItemId, isActive: true } }),
      tx.user.findFirst({ where: { id: data.supervisorUserId, role: "SUPERVISOR", isActive: true } }),
    ]);
    if (!item || !supervisor) throw new Error("ITEM_OR_SUPERVISOR_UNAVAILABLE");
    const stock = await getStock(tx, item.id, item.type);
    if (stock.available.lessThan(quantity)) throw new Error("INSUFFICIENT_STOCK");
    const issue = await tx.inventoryIssue.create({ data: { supervisorUserId: supervisor.id, issuedByUserId: adminId, issueDate: data.issueDate, status: "ISSUED", notes: data.notes } });
    const issueItem = await tx.inventoryIssueItem.create({ data: { inventoryIssueId: issue.id, inventoryItemId: item.id, quantityIssued: quantity } });
    if (item.type === "CONSUMABLE") await tx.inventoryMovement.create({ data: { inventoryItemId: item.id, movementType: "CONSUMABLE_ISSUE_OUT", quantity, inventoryIssueItemId: issueItem.id, createdByUserId: adminId } });
    await tx.auditLog.create({ data: { userId: adminId, action: "INVENTORY_ISSUED", entityType: "InventoryIssue", entityId: issue.id, newValues: { itemId: item.id, quantity: quantity.toString(), supervisorId: supervisor.id } } });
    return issue;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function closeInventoryIssue(input: unknown, adminId: string) {
  const data = issueCloseInput.parse(input);
  const returned = new Prisma.Decimal(data.returned), damaged = new Prisma.Decimal(data.damaged), lost = new Prisma.Decimal(data.lost);
  return prisma.$transaction(async (tx) => {
    const row = await tx.inventoryIssueItem.findUnique({ where: { id: data.issueItemId }, include: { inventoryItem: true, inventoryIssue: true } });
    if (!row || row.inventoryIssue.status !== "ISSUED") throw new Error("ISSUE_NOT_OPEN");
    if (returned.add(damaged).add(lost).greaterThan(row.quantityIssued)) throw new Error("QUANTITY_EXCEEDS_ISSUED");
    if (row.inventoryItem.type === "REUSABLE" && !returned.add(damaged).add(lost).equals(row.quantityIssued)) throw new Error("REUSABLE_ITEMS_MUST_BE_ACCOUNTED_FOR");
    await tx.inventoryIssueItem.update({ where: { id: row.id }, data: { quantityReturned: returned, quantityDamaged: damaged, quantityLost: lost, returnedAt: new Date(), notes: data.notes } });
    const movements: Prisma.InventoryMovementCreateManyInput[] = [];
    if (row.inventoryItem.type === "CONSUMABLE" && returned.greaterThan(0)) movements.push({ inventoryItemId: row.inventoryItemId, movementType: "CONSUMABLE_RETURN_IN", quantity: returned, inventoryIssueItemId: row.id, createdByUserId: adminId });
    if (row.inventoryItem.type === "REUSABLE" && damaged.greaterThan(0)) movements.push({ inventoryItemId: row.inventoryItemId, movementType: "DAMAGED_OUT", quantity: damaged, inventoryIssueItemId: row.id, createdByUserId: adminId });
    if (row.inventoryItem.type === "REUSABLE" && lost.greaterThan(0)) movements.push({ inventoryItemId: row.inventoryItemId, movementType: "LOST_OUT", quantity: lost, inventoryIssueItemId: row.id, createdByUserId: adminId });
    if (movements.length) await tx.inventoryMovement.createMany({ data: movements });
    await tx.inventoryIssue.update({ where: { id: row.inventoryIssueId }, data: { status: "CLOSED", closedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: adminId, action: "INVENTORY_RETURNED", entityType: "InventoryIssue", entityId: row.inventoryIssueId, newValues: { returned: returned.toString(), damaged: damaged.toString(), lost: lost.toString() } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function adjustStock(input: unknown, adminId: string) {
  const data = adjustmentInput.parse(input), quantity = new Prisma.Decimal(data.quantity);
  return prisma.$transaction(async (tx) => {
    if (data.direction === "OUT") {
      const stock = await getStock(tx, data.inventoryItemId);
      if (stock.available.lessThan(quantity)) throw new Error("INSUFFICIENT_STOCK");
    }
    const movement = await tx.inventoryMovement.create({ data: { inventoryItemId: data.inventoryItemId, movementType: data.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", quantity, notes: data.reason, createdByUserId: adminId } });
    await tx.auditLog.create({ data: { userId: adminId, action: "STOCK_ADJUSTED", entityType: "InventoryMovement", entityId: movement.id, newValues: { direction: data.direction, quantity: quantity.toString(), reason: data.reason } } });
    return movement;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
