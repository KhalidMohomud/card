import "server-only";
import { Prisma, type InventoryItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { movementBalance } from "@/modules/business-rules";

type Db = Prisma.TransactionClient | typeof prisma;

export async function getStock(db: Db, inventoryItemId: string, type?: InventoryItemType) {
  const item = type ? { type } : await db.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId }, select: { type: true } });
  const movements = await db.inventoryMovement.findMany({ where: { inventoryItemId }, select: { movementType: true, quantity: true } });
  const owned = movementBalance(movements);
  if (item.type === "CONSUMABLE") return { owned, assigned: new Prisma.Decimal(0), available: owned };
  const issueItems = await db.inventoryIssueItem.findMany({
    where: { inventoryItemId, inventoryIssue: { status: { in: ["ISSUED", "CLOSED"] } } },
    select: { quantityIssued: true, quantityReturned: true, quantityDamaged: true, quantityLost: true },
  });
  const assigned = issueItems.reduce((total, row) => total.add(row.quantityIssued).sub(row.quantityReturned).sub(row.quantityDamaged).sub(row.quantityLost), new Prisma.Decimal(0));
  return { owned, assigned, available: owned.sub(assigned) };
}

export async function stockSnapshot() {
  const items = await prisma.inventoryItem.findMany({ where: { isActive: true }, include: { category: true }, orderBy: { name: "asc" } });
  return Promise.all(items.map(async (item) => ({ ...item, ...(await getStock(prisma, item.id, item.type)) })));
}
