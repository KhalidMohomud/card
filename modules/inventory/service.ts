import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adjustmentInput, inventoryIssueCancelInput, inventoryIssueUpdateInput, issueCloseInput, issueInput, stocktakeInput } from "@/lib/validation";
import { getStock, getStocks } from "@/modules/inventory/stock";

const inventoryTransaction = { maxWait: 10_000, timeout: 20_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

type HandoverSnapshot = {
  supervisorUserId: string; issueDate: Date; status: string; notes: string | null;
  items: { inventoryItemId: string; quantityIssued: Prisma.Decimal; conditionOut: string; notes: string | null }[];
};

function handoverSnapshot(issue: HandoverSnapshot) {
  return {
    supervisorUserId: issue.supervisorUserId,
    issueDate: issue.issueDate.toISOString(),
    status: issue.status,
    notes: issue.notes,
    items: issue.items.map((line) => ({ inventoryItemId: line.inventoryItemId, quantity: line.quantityIssued.toString(), conditionOut: line.conditionOut, notes: line.notes })),
  };
}

export async function issueInventory(input: unknown, userId: string) {
  const data = issueInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const [supervisor, inventoryItems] = await Promise.all([
      tx.user.findFirst({ where: { id: data.supervisorUserId, role: "SUPERVISOR", isActive: true }, select: { id: true } }),
      tx.inventoryItem.findMany({ where: { id: { in: data.items.map((line) => line.inventoryItemId) }, isActive: true } }),
    ]);
    if (!supervisor || inventoryItems.length !== data.items.length) throw new Error("ITEM_OR_SUPERVISOR_UNAVAILABLE");
    const itemsById = new Map(inventoryItems.map((item) => [item.id, item]));

    const stocks = await getStocks(tx, inventoryItems);
    for (const line of data.items) {
      const item = itemsById.get(line.inventoryItemId)!;
      if (item.type === "CONSUMABLE" && line.conditionOut !== "GOOD") throw new Error("CONSUMABLE_CONDITION_INVALID");
      const stock = stocks.get(item.id)!;
      if (stock.available.lessThan(new Prisma.Decimal(line.quantity))) throw new Error(`INSUFFICIENT_STOCK_DETAIL:${JSON.stringify({ name: item.name, available: stock.available.toString(), unit: item.unit })}`);
    }

    const issue = await tx.inventoryIssue.create({
      data: {
        supervisorUserId: supervisor.id, issuedByUserId: userId, issueDate: data.issueDate,
        status: "ISSUED", notes: data.notes,
        items: { create: data.items.map((line) => ({
          inventoryItemId: line.inventoryItemId, quantityIssued: new Prisma.Decimal(line.quantity),
          conditionOut: line.conditionOut, notes: line.notes,
        })) },
      },
      include: { items: { include: { inventoryItem: { select: { type: true } } } } },
    });
    const movements = issue.items.filter((line) => line.inventoryItem.type === "CONSUMABLE").map((line) => ({
      inventoryItemId: line.inventoryItemId, movementType: "CONSUMABLE_ISSUE_OUT" as const,
      quantity: line.quantityIssued, inventoryIssueItemId: line.id, createdByUserId: userId,
    }));
    if (movements.length) await tx.inventoryMovement.createMany({ data: movements });
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_HANDOVER_CREATED", entityType: "InventoryIssue", entityId: issue.id, newValues: { supervisorId: supervisor.id, issueDate: data.issueDate.toISOString(), lines: data.items.length } } });
    return issue;
  }, inventoryTransaction);
}

export async function updateInventoryIssue(input: unknown, userId: string) {
  const data = inventoryIssueUpdateInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const current = await tx.inventoryIssue.findUnique({ where: { id: data.id }, include: { items: true } });
    if (!current) throw new Error("ISSUE_NOT_FOUND");
    if (current.status !== "ISSUED") throw new Error("ISSUE_NOT_EDITABLE");
    const [supervisor, inventoryItems] = await Promise.all([
      tx.user.findFirst({ where: { id: data.supervisorUserId, role: "SUPERVISOR", isActive: true }, select: { id: true } }),
      tx.inventoryItem.findMany({ where: { id: { in: data.items.map((line) => line.inventoryItemId) }, isActive: true } }),
    ]);
    if (!supervisor || inventoryItems.length !== data.items.length) throw new Error("ITEM_OR_SUPERVISOR_UNAVAILABLE");
    const itemsById = new Map(inventoryItems.map((item) => [item.id, item]));
    const stockItems = new Map(inventoryItems.map((item) => [item.id, item]));
    const currentItemRows = await tx.inventoryItem.findMany({ where: { id: { in: current.items.map((line) => line.inventoryItemId) } } });
    for (const item of currentItemRows) stockItems.set(item.id, item);
    const stocks = await getStocks(tx, [...stockItems.values()]);
    const currentQuantityByItem = new Map(current.items.map((line) => [line.inventoryItemId, line.quantityIssued]));
    for (const line of data.items) {
      const item = itemsById.get(line.inventoryItemId)!;
      if (item.type === "CONSUMABLE" && line.conditionOut !== "GOOD") throw new Error("CONSUMABLE_CONDITION_INVALID");
      const effectiveAvailable = stocks.get(item.id)!.available.add(currentQuantityByItem.get(item.id) ?? new Prisma.Decimal(0));
      if (effectiveAvailable.lessThan(new Prisma.Decimal(line.quantity))) throw new Error(`INSUFFICIENT_STOCK_DETAIL:${JSON.stringify({ name: item.name, available: effectiveAvailable.toString(), unit: item.unit })}`);
    }
    const changed = await tx.inventoryIssue.updateMany({
      where: { id: data.id, status: "ISSUED" },
      data: { supervisorUserId: supervisor.id, issueDate: data.issueDate, notes: data.notes ?? null },
    });
    if (changed.count !== 1) throw new Error("ISSUE_NOT_EDITABLE");
    await tx.inventoryMovement.deleteMany({ where: { inventoryIssueItemId: { in: current.items.map((line) => line.id) } } });
    await tx.inventoryIssueItem.deleteMany({ where: { inventoryIssueId: data.id } });
    await tx.inventoryIssueItem.createMany({ data: data.items.map((line) => ({
      inventoryIssueId: data.id, inventoryItemId: line.inventoryItemId, quantityIssued: new Prisma.Decimal(line.quantity), conditionOut: line.conditionOut, notes: line.notes,
    })) });
    const updated = await tx.inventoryIssue.findUniqueOrThrow({ where: { id: data.id }, include: { items: { include: { inventoryItem: { select: { type: true } } } } } });
    const movements = updated.items.filter((line) => line.inventoryItem.type === "CONSUMABLE").map((line) => ({
      inventoryItemId: line.inventoryItemId, movementType: "CONSUMABLE_ISSUE_OUT" as const,
      quantity: line.quantityIssued, inventoryIssueItemId: line.id, createdByUserId: userId,
    }));
    if (movements.length) await tx.inventoryMovement.createMany({ data: movements });
    await tx.auditLog.create({ data: {
      userId, action: "INVENTORY_HANDOVER_UPDATED", entityType: "InventoryIssue", entityId: data.id,
      oldValues: handoverSnapshot(current), newValues: handoverSnapshot(updated),
    } });
    return updated;
  }, inventoryTransaction);
}

export async function deleteInventoryIssue(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.inventoryIssue.findUnique({ where: { id }, include: { items: true } });
    if (!current) throw new Error("ISSUE_NOT_FOUND");
    if (current.status !== "ISSUED") throw new Error("ISSUE_NOT_DELETABLE");
    const changed = await tx.inventoryIssue.updateMany({ where: { id, status: "ISSUED" }, data: { status: "DRAFT" } });
    if (changed.count !== 1) throw new Error("ISSUE_NOT_DELETABLE");
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_HANDOVER_DELETED", entityType: "InventoryIssue", entityId: id, oldValues: handoverSnapshot(current) } });
    await tx.inventoryMovement.deleteMany({ where: { inventoryIssueItemId: { in: current.items.map((line) => line.id) } } });
    await tx.inventoryIssueItem.deleteMany({ where: { inventoryIssueId: id } });
    await tx.inventoryIssue.delete({ where: { id } });
  }, inventoryTransaction);
}

export async function closeInventoryIssue(input: unknown, userId: string) {
  const data = issueCloseInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const issue = await tx.inventoryIssue.findUnique({ where: { id: data.issueId }, include: { items: { include: { inventoryItem: true } } } });
    if (!issue || issue.status !== "ISSUED") throw new Error("ISSUE_NOT_OPEN");
    if (data.items.length !== issue.items.length || new Set(data.items.map((line) => line.issueItemId)).size !== issue.items.length) throw new Error("ISSUE_LINES_INCOMPLETE");
    const outcomes = new Map(data.items.map((line) => [line.issueItemId, line]));
    const movementRows: Prisma.InventoryMovementCreateManyInput[] = [];

    for (const row of issue.items) {
      const outcome = outcomes.get(row.id);
      if (!outcome) throw new Error("ISSUE_LINES_INCOMPLETE");
      const returned = new Prisma.Decimal(outcome.returned), damaged = new Prisma.Decimal(outcome.damaged), lost = new Prisma.Decimal(outcome.lost);
      const accounted = returned.add(damaged).add(lost);
      if (accounted.greaterThan(row.quantityIssued)) throw new Error("QUANTITY_EXCEEDS_ISSUED");
      if (row.inventoryItem.type === "REUSABLE" && !accounted.equals(row.quantityIssued)) throw new Error("REUSABLE_ITEMS_MUST_BE_ACCOUNTED_FOR");
      if (row.inventoryItem.type === "CONSUMABLE" && (damaged.greaterThan(0) || lost.greaterThan(0))) throw new Error("CONSUMABLE_OUTCOME_INVALID");
      if ((damaged.greaterThan(0) || lost.greaterThan(0)) && !outcome.notes) throw new Error("LOSS_DAMAGE_REASON_REQUIRED");

      await tx.inventoryIssueItem.update({ where: { id: row.id }, data: {
        quantityReturned: returned, quantityDamaged: damaged, quantityLost: lost,
        returnedAt: new Date(), conditionIn: row.inventoryItem.type === "REUSABLE" ? (lost.greaterThan(0) ? "LOST" : damaged.greaterThan(0) ? "DAMAGED" : outcome.conditionIn ?? "GOOD") : null, notes: outcome.notes,
      } });
      if (row.inventoryItem.type === "CONSUMABLE" && returned.greaterThan(0)) movementRows.push({ inventoryItemId: row.inventoryItemId, movementType: "CONSUMABLE_RETURN_IN", quantity: returned, inventoryIssueItemId: row.id, createdByUserId: userId });
      if (row.inventoryItem.type === "REUSABLE" && damaged.greaterThan(0)) movementRows.push({ inventoryItemId: row.inventoryItemId, movementType: "DAMAGED_OUT", quantity: damaged, inventoryIssueItemId: row.id, createdByUserId: userId, notes: outcome.notes });
      if (row.inventoryItem.type === "REUSABLE" && lost.greaterThan(0)) movementRows.push({ inventoryItemId: row.inventoryItemId, movementType: "LOST_OUT", quantity: lost, inventoryIssueItemId: row.id, createdByUserId: userId, notes: outcome.notes });
    }

    const changed = await tx.inventoryIssue.updateMany({ where: { id: issue.id, status: "ISSUED" }, data: { status: "CLOSED", closedAt: new Date(), closedByUserId: userId } });
    if (changed.count !== 1) throw new Error("ISSUE_NOT_OPEN");
    if (movementRows.length) await tx.inventoryMovement.createMany({ data: movementRows });
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_HANDOVER_RECONCILED", entityType: "InventoryIssue", entityId: issue.id, newValues: { lines: data.items.map((line) => ({ id: line.issueItemId, returned: line.returned, damaged: line.damaged, lost: line.lost, condition: line.conditionIn })) } } });
  }, inventoryTransaction);
}

export async function cancelInventoryIssue(input: unknown, userId: string) {
  const data = inventoryIssueCancelInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const issue = await tx.inventoryIssue.findUnique({ where: { id: data.id }, include: { items: { include: { inventoryItem: { select: { type: true } } } } } });
    if (!issue || issue.status !== "ISSUED") throw new Error("ISSUE_NOT_CANCELLABLE");
    const changed = await tx.inventoryIssue.updateMany({ where: { id: data.id, status: "ISSUED" }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledByUserId: userId, cancellationReason: data.reason } });
    if (changed.count !== 1) throw new Error("ISSUE_NOT_CANCELLABLE");
    const reversals = issue.items.filter((line) => line.inventoryItem.type === "CONSUMABLE").map((line) => ({
      inventoryItemId: line.inventoryItemId, movementType: "CONSUMABLE_RETURN_IN" as const,
      quantity: line.quantityIssued, inventoryIssueItemId: line.id, createdByUserId: userId, notes: `Cancelled handover: ${data.reason}`,
    }));
    if (reversals.length) await tx.inventoryMovement.createMany({ data: reversals });
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_HANDOVER_CANCELLED", entityType: "InventoryIssue", entityId: issue.id, oldValues: { status: issue.status }, newValues: { status: "CANCELLED", reason: data.reason } } });
  }, inventoryTransaction);
}

export async function adjustStock(input: unknown, userId: string) {
  const data = adjustmentInput.parse(input), quantity = new Prisma.Decimal(data.quantity);
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findFirst({ where: { id: data.inventoryItemId, isActive: true }, select: { id: true } });
    if (!item) throw new Error("INVENTORY_ITEM_UNAVAILABLE");
    if (data.direction === "OUT") {
      const stock = await getStock(tx, data.inventoryItemId);
      if (stock.available.lessThan(quantity)) throw new Error("INSUFFICIENT_STOCK");
    }
    const movement = await tx.inventoryMovement.create({ data: { inventoryItemId: data.inventoryItemId, movementType: data.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", quantity, notes: data.reason, createdByUserId: userId } });
    await tx.auditLog.create({ data: { userId, action: "STOCK_ADJUSTED", entityType: "InventoryMovement", entityId: movement.id, newValues: { direction: data.direction, quantity: quantity.toString(), reason: data.reason } } });
    return movement;
  }, inventoryTransaction);
}

export async function reconcileStocktake(input: unknown, userId: string) {
  const data = stocktakeInput.parse(input), counted = new Prisma.Decimal(data.countedAvailable);
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findFirst({ where: { id: data.inventoryItemId, isActive: true }, select: { id: true } });
    if (!item) throw new Error("INVENTORY_ITEM_UNAVAILABLE");
    const stock = await getStock(tx, item.id);
    const difference = counted.sub(stock.available);
    if (difference.isZero()) throw new Error("STOCKTAKE_NO_VARIANCE");
    const movement = await tx.inventoryMovement.create({ data: {
      inventoryItemId: item.id, movementType: difference.isPositive() ? "STOCKTAKE_IN" : "STOCKTAKE_OUT",
      quantity: difference.abs(), notes: data.reason, createdByUserId: userId,
    } });
    await tx.auditLog.create({ data: { userId, action: "STOCKTAKE_RECONCILED", entityType: "InventoryMovement", entityId: movement.id, newValues: { expectedAvailable: stock.available.toString(), countedAvailable: counted.toString(), variance: difference.toString(), reason: data.reason } } });
    return movement;
  }, inventoryTransaction);
}
