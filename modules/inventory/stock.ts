import "server-only";
import { Prisma, type InventoryItemType } from "@prisma/client";
import { prisma, type AppTransactionClient } from "@/lib/prisma";
import { movementBalance } from "@/modules/business-rules";

type Db = AppTransactionClient | typeof prisma;

type StockItem = { id: string; type: InventoryItemType };

export async function getStocks(db: Db, items: StockItem[]) {
  const ids = [...new Set(items.map((item) => item.id))];
  if (!ids.length) return new Map<string, { owned: Prisma.Decimal; assigned: Prisma.Decimal; available: Prisma.Decimal }>();
  const reusableIds = items.filter((item) => item.type === "REUSABLE").map((item) => item.id);
  const [movementGroups, issueGroups] = await Promise.all([
    db.inventoryMovement.groupBy({ by: ["inventoryItemId", "movementType"], where: { inventoryItemId: { in: ids } }, _sum: { quantity: true } }),
    reusableIds.length
      ? db.inventoryIssueItem.groupBy({
          by: ["inventoryItemId"],
          where: { inventoryItemId: { in: reusableIds }, inventoryIssue: { status: { in: ["ISSUED", "CLOSED"] } } },
          _sum: { quantityIssued: true, quantityReturned: true, quantityDamaged: true, quantityLost: true },
        })
      : Promise.resolve([]),
  ]);
  const movementsByItem = new Map<string, { movementType: string; quantity: Prisma.Decimal }[]>();
  for (const movement of movementGroups) {
    const rows = movementsByItem.get(movement.inventoryItemId) ?? [];
    rows.push({ movementType: movement.movementType, quantity: movement._sum.quantity ?? new Prisma.Decimal(0) });
    movementsByItem.set(movement.inventoryItemId, rows);
  }
  const assignedByItem = new Map<string, Prisma.Decimal>();
  for (const issue of issueGroups) {
    assignedByItem.set(issue.inventoryItemId, (issue._sum.quantityIssued ?? new Prisma.Decimal(0))
      .sub(issue._sum.quantityReturned ?? new Prisma.Decimal(0))
      .sub(issue._sum.quantityDamaged ?? new Prisma.Decimal(0))
      .sub(issue._sum.quantityLost ?? new Prisma.Decimal(0)));
  }
  return new Map(items.map((item) => {
    const owned = movementBalance(movementsByItem.get(item.id) ?? []);
    const assigned = item.type === "REUSABLE" ? (assignedByItem.get(item.id) ?? new Prisma.Decimal(0)) : new Prisma.Decimal(0);
    return [item.id, { owned, assigned, available: owned.sub(assigned) }];
  }));
}

export async function getStock(db: Db, inventoryItemId: string, type?: InventoryItemType) {
  const item = type ? { type } : await db.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId }, select: { type: true } });
  return (await getStocks(db, [{ id: inventoryItemId, type: item.type }])).get(inventoryItemId)!;
}

export async function stockSnapshot() {
  const [items, movementGroups, issueGroups] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { isActive: true }, include: { category: true }, orderBy: { name: "asc" } }),
    prisma.inventoryMovement.groupBy({ by: ["inventoryItemId", "movementType"], where: { inventoryItem: { isActive: true } }, _sum: { quantity: true } }),
    prisma.inventoryIssueItem.groupBy({
      by: ["inventoryItemId"],
      where: { inventoryItem: { isActive: true, type: "REUSABLE" }, inventoryIssue: { status: { in: ["ISSUED", "CLOSED"] } } },
      _sum: { quantityIssued: true, quantityReturned: true, quantityDamaged: true, quantityLost: true },
    }),
  ]);
  const movementsByItem = new Map<string, { movementType: string; quantity: Prisma.Decimal }[]>();
  for (const movement of movementGroups) {
    const rows = movementsByItem.get(movement.inventoryItemId) ?? [];
    rows.push({ movementType: movement.movementType, quantity: movement._sum.quantity ?? new Prisma.Decimal(0) });
    movementsByItem.set(movement.inventoryItemId, rows);
  }
  const assignedByItem = new Map<string, Prisma.Decimal>();
  for (const issue of issueGroups) {
    const assigned = (issue._sum.quantityIssued ?? new Prisma.Decimal(0))
      .sub(issue._sum.quantityReturned ?? new Prisma.Decimal(0))
      .sub(issue._sum.quantityDamaged ?? new Prisma.Decimal(0))
      .sub(issue._sum.quantityLost ?? new Prisma.Decimal(0));
    assignedByItem.set(issue.inventoryItemId, assigned);
  }
  return items.map((item) => {
    const owned = movementBalance(movementsByItem.get(item.id) ?? []);
    const assigned = item.type === "REUSABLE" ? (assignedByItem.get(item.id) ?? new Prisma.Decimal(0)) : new Prisma.Decimal(0);
    return { ...item, owned, assigned, available: owned.sub(assigned) };
  });
}
