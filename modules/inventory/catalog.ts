import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  inventoryCategoryInput,
  inventoryCategoryUpdateInput,
  inventoryItemInput,
  inventoryItemUpdateInput,
  supplierInput,
  supplierUpdateInput,
} from "@/lib/validation";

export async function createInventoryCategory(input: unknown, userId: string) {
  const data = inventoryCategoryInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const category = await tx.inventoryCategory.create({ data });
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_CATEGORY_CREATED", entityType: "InventoryCategory", entityId: category.id, newValues: { name: category.name, isActive: category.isActive } } });
    return category;
  });
}

export async function updateInventoryCategory(input: unknown, userId: string) {
  const data = inventoryCategoryUpdateInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const current = await tx.inventoryCategory.findUnique({ where: { id: data.id } });
    if (!current) throw new Error("INVENTORY_CATEGORY_NOT_FOUND");
    const category = await tx.inventoryCategory.update({ where: { id: data.id }, data: { name: data.name, isActive: data.isActive } });
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_CATEGORY_UPDATED", entityType: "InventoryCategory", entityId: category.id, oldValues: { name: current.name, isActive: current.isActive }, newValues: { name: category.name, isActive: category.isActive } } });
    return category;
  });
}

export async function deleteInventoryCategory(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.inventoryCategory.findUnique({ where: { id }, select: { id: true, name: true, _count: { select: { items: true } } } });
    if (!category) throw new Error("INVENTORY_CATEGORY_NOT_FOUND");
    if (category._count.items > 0) throw new Error("INVENTORY_CATEGORY_NOT_DELETABLE");
    await tx.inventoryCategory.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_CATEGORY_DELETED", entityType: "InventoryCategory", entityId: id, oldValues: { name: category.name } } });
  });
}

export async function createSupplier(input: unknown, userId: string) {
  const data = supplierInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({ data: normalizeSupplier(data) });
    await tx.auditLog.create({ data: { userId, action: "SUPPLIER_CREATED", entityType: "Supplier", entityId: supplier.id, newValues: supplierAuditValues(supplier) } });
    return supplier;
  });
}

export async function updateSupplier(input: unknown, userId: string) {
  const data = supplierUpdateInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const current = await tx.supplier.findUnique({ where: { id: data.id } });
    if (!current) throw new Error("SUPPLIER_NOT_FOUND");
    const supplier = await tx.supplier.update({ where: { id: data.id }, data: { ...normalizeSupplier(data), isActive: data.isActive } });
    await tx.auditLog.create({ data: { userId, action: "SUPPLIER_UPDATED", entityType: "Supplier", entityId: supplier.id, oldValues: supplierAuditValues(current), newValues: supplierAuditValues(supplier) } });
    return supplier;
  });
}

export async function deleteSupplier(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id }, select: { id: true, name: true, _count: { select: { purchases: true } } } });
    if (!supplier) throw new Error("SUPPLIER_NOT_FOUND");
    if (supplier._count.purchases > 0) throw new Error("SUPPLIER_NOT_DELETABLE");
    await tx.supplier.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId, action: "SUPPLIER_DELETED", entityType: "Supplier", entityId: id, oldValues: { name: supplier.name } } });
  });
}

export async function createInventoryItem(input: unknown, userId: string) {
  const data = inventoryItemInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const category = await tx.inventoryCategory.findFirst({ where: { id: data.categoryId, isActive: true }, select: { id: true } });
    if (!category) throw new Error("INVENTORY_CATEGORY_UNAVAILABLE");
    const item = await tx.inventoryItem.create({ data: { ...data, minimumStockLevel: new Prisma.Decimal(data.minimumStockLevel) } });
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_ITEM_CREATED", entityType: "InventoryItem", entityId: item.id, newValues: inventoryItemAuditValues(item) } });
    return item;
  });
}

export async function updateInventoryItem(input: unknown, userId: string) {
  const data = inventoryItemUpdateInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const [current, category] = await Promise.all([
      tx.inventoryItem.findUnique({ where: { id: data.id }, include: { _count: { select: { purchaseItems: true, issueItems: true, movements: true } } } }),
      tx.inventoryCategory.findFirst({ where: { id: data.categoryId, isActive: true }, select: { id: true } }),
    ]);
    if (!current) throw new Error("INVENTORY_ITEM_NOT_FOUND");
    if (!category) throw new Error("INVENTORY_CATEGORY_UNAVAILABLE");
    const hasHistory = current._count.purchaseItems + current._count.issueItems + current._count.movements > 0;
    if (hasHistory && (current.type !== data.type || current.unit !== data.unit)) throw new Error("INVENTORY_ITEM_TRACKING_LOCKED");
    const item = await tx.inventoryItem.update({ where: { id: data.id }, data: { categoryId: data.categoryId, sku: data.sku, name: data.name, type: data.type, unit: data.unit, minimumStockLevel: new Prisma.Decimal(data.minimumStockLevel), description: data.description ?? null, isActive: data.isActive } });
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_ITEM_UPDATED", entityType: "InventoryItem", entityId: item.id, oldValues: inventoryItemAuditValues(current), newValues: inventoryItemAuditValues(item) } });
    return item;
  });
}

export async function deleteInventoryItem(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id }, select: { id: true, name: true, sku: true, _count: { select: { purchaseItems: true, issueItems: true, movements: true } } } });
    if (!item) throw new Error("INVENTORY_ITEM_NOT_FOUND");
    if (item._count.purchaseItems + item._count.issueItems + item._count.movements > 0) throw new Error("INVENTORY_ITEM_NOT_DELETABLE");
    await tx.inventoryItem.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId, action: "INVENTORY_ITEM_DELETED", entityType: "InventoryItem", entityId: id, oldValues: { name: item.name, sku: item.sku } } });
  });
}

function normalizeSupplier(data: { name: string; phone?: string; email?: string; address?: string; notes?: string }) {
  return { name: data.name, phone: data.phone ?? null, email: data.email || null, address: data.address ?? null, notes: data.notes ?? null };
}

function supplierAuditValues(supplier: { name: string; isActive: boolean }) {
  // Contact details and free-form notes are intentionally excluded from the
  // long-lived audit ledger; the event still records identity and state.
  return { name: supplier.name, isActive: supplier.isActive };
}

function inventoryItemAuditValues(item: { categoryId: string; sku: string; name: string; type: string; unit: string; minimumStockLevel: Prisma.Decimal; description: string | null; isActive: boolean }) {
  return { categoryId: item.categoryId, sku: item.sku, name: item.name, type: item.type, unit: item.unit, minimumStockLevel: item.minimumStockLevel.toString(), description: item.description, isActive: item.isActive };
}
