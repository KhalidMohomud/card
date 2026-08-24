import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessDateEnd, businessDateInputValue, businessDateStart, getBusinessPeriods } from "@/lib/dates";
import { stockSnapshot } from "@/modules/inventory/stock";

export const CACHE_TAGS = {
  audit: "swiftwash:audit",
  catalog: "swiftwash:catalog",
  dashboard: "swiftwash:dashboard",
  expenses: "swiftwash:expenses",
  inventory: "swiftwash:inventory",
  issues: "swiftwash:issues",
  purchases: "swiftwash:purchases",
  receipts: "swiftwash:receipts",
  reference: "swiftwash:reference",
  reports: "swiftwash:reports",
  supervisors: "swiftwash:supervisors",
} as const;

export const getCatalogData = unstable_cache(async () => {
  const [services, methods, settings] = await Promise.all([
    prisma.service.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, price: true, description: true, isActive: true } }),
    prisma.paymentMethod.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
    prisma.businessSetting.findUnique({ where: { id: "singleton" }, select: { businessName: true, phone: true, email: true, address: true, currencyCode: true, receiptFooter: true, logoUrl: true } }),
  ]);
  return {
    services: services.map((row) => ({ ...row, price: row.price.toFixed(2) })),
    methods,
    settings,
  };
}, ["swiftwash-catalog-v1"], { tags: [CACHE_TAGS.catalog], revalidate: 60 * 60 });

export const getReferenceData = unstable_cache(async () => {
  const [categories, suppliers, supervisors, inventoryItems] = await Promise.all([
    prisma.inventoryCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true, email: true, address: true } }),
    prisma.user.findMany({ where: { role: "SUPERVISOR" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, username: true, displayUsername: true, isActive: true } }),
    prisma.inventoryItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, type: true, unit: true, categoryId: true, minimumStockLevel: true } }),
  ]);
  return {
    categories,
    suppliers,
    supervisors,
    inventoryItems: inventoryItems.map((row) => ({ ...row, minimumStockLevel: row.minimumStockLevel.toString() })),
  };
}, ["swiftwash-reference-v1"], { tags: [CACHE_TAGS.reference], revalidate: 60 * 60 });

export const getInventoryItemsForManagement = unstable_cache(async () => {
  const rows = await prisma.inventoryItem.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true, categoryId: true, sku: true, name: true, type: true, unit: true, minimumStockLevel: true,
      description: true, isActive: true, createdAt: true, category: { select: { id: true, name: true, isActive: true } },
      _count: { select: { purchaseItems: true, issueItems: true, movements: true } },
    },
  });
  return rows.map((row) => ({ ...row, minimumStockLevel: row.minimumStockLevel.toString(), createdAt: row.createdAt.toISOString() }));
}, ["swiftwash-inventory-items-management-v1"], { tags: [CACHE_TAGS.inventory, CACHE_TAGS.reference], revalidate: 5 * 60 });

export const getInventoryCategoriesForManagement = unstable_cache(async () => {
  const rows = await prisma.inventoryCategory.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true, createdAt: true, _count: { select: { items: true } } },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}, ["swiftwash-inventory-categories-management-v1"], { tags: [CACHE_TAGS.inventory, CACHE_TAGS.reference], revalidate: 5 * 60 });

export const getSuppliersForManagement = unstable_cache(async () => {
  const rows = await prisma.supplier.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, phone: true, email: true, address: true, notes: true, isActive: true, createdAt: true, _count: { select: { purchases: true } } },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}, ["swiftwash-suppliers-management-v1"], { tags: [CACHE_TAGS.purchases, CACHE_TAGS.reference], revalidate: 5 * 60 });

export const getSupervisorAccounts = unstable_cache(async () => {
  const users = await prisma.user.findMany({ where: { role: { in: ["SUPERVISOR", "MANAGER"] } }, orderBy: { createdAt: "desc" }, select: { id: true, fullName: true, username: true, displayUsername: true, role: true, isActive: true, createdAt: true, _count: { select: { receiptsCreated: true } } } });
  return users.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}, ["swiftwash-staff-accounts-v2"], { tags: [CACHE_TAGS.supervisors, CACHE_TAGS.reference], revalidate: 5 * 60 });

const getReceiptLedgerForQuery = unstable_cache(async (statusValue: string, fromValue: string, toValue: string, searchValue: string, page: number) => {
  const status = statusValue === "COMPLETED" || statusValue === "CANCELLED" ? statusValue : undefined;
  const search = searchValue.trim().slice(0, 120);
  const normalizedReceiptNumber = search.replace(/^#/, "").replace(/^0+/, "") || "0";
  const receiptId = /^\d+$/.test(normalizedReceiptNumber) ? Number(normalizedReceiptNumber) : undefined;
  const matchingStatuses = (["COMPLETED", "CANCELLED"] as const).filter((value) => value.toLowerCase().includes(search.toLowerCase()));
  const where: Prisma.ReceiptWhereInput = {
    ...(status ? { status } : {}),
    ...(fromValue || toValue ? { issuedAt: { gte: fromValue ? businessDateStart(fromValue) : undefined, lte: toValue ? businessDateEnd(toValue) : undefined } } : {}),
    ...(search ? { OR: [
      ...(receiptId && Number.isSafeInteger(receiptId) ? [{ id: receiptId }] : []),
      { serviceNameSnapshot: { contains: search, mode: "insensitive" as const } },
      { createdByUser: { is: { OR: [{ fullName: { contains: search, mode: "insensitive" as const } }, { username: { contains: search, mode: "insensitive" as const } }] } } },
      { paymentMethod: { is: { name: { contains: search, mode: "insensitive" as const } } } },
      ...matchingStatuses.map((matchingStatus) => ({ status: matchingStatus })),
    ] } : {}),
  };
  const take = 25;
  const [rows, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * take,
      take,
      select: { id: true, issuedAt: true, serviceNameSnapshot: true, servicePriceSnapshot: true, status: true, paymentMethod: { select: { name: true } }, createdByUser: { select: { fullName: true } } },
    }),
    prisma.receipt.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((row) => ({ id: row.id, issuedAt: row.issuedAt.toISOString(), service: row.serviceNameSnapshot, total: row.servicePriceSnapshot.toFixed(2), status: row.status, payment: row.paymentMethod.name, supervisor: row.createdByUser.fullName })),
  };
}, ["swiftwash-receipt-ledger-v2"], { tags: [CACHE_TAGS.receipts, CACHE_TAGS.catalog], revalidate: 5 * 60 });

export function getReceiptLedger(status: string | undefined, from: string | undefined, to: string | undefined, search: string | undefined, page: number) {
  return getReceiptLedgerForQuery(status ?? "", from ?? "", to ?? "", search ?? "", page);
}

const getExpenseLedgerForPage = unstable_cache(async (page: number) => {
  const take = 25;
  const [rows, total] = await Promise.all([
    prisma.expense.findMany({
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * take,
      take,
      select: {
        id: true, expenseDate: true, type: true, title: true, amount: true, paymentStatus: true, status: true,
        categoryId: true, supervisorUserId: true, paymentMethodId: true, carCount: true, ratePerCar: true,
        periodStart: true, periodEnd: true, paymentReference: true, notes: true, commissionOverrideReason: true,
        category: { select: { id: true, name: true } }, supervisor: { select: { id: true, fullName: true } },
      },
    }),
    prisma.expense.count(),
  ]);
  return {
    total,
    rows: rows.map((row) => ({
      ...row,
      expenseDate: row.expenseDate.toISOString(), amount: row.amount.toFixed(2), ratePerCar: row.ratePerCar?.toFixed(2) ?? null,
      periodStart: row.periodStart?.toISOString() ?? null, periodEnd: row.periodEnd?.toISOString() ?? null,
    })),
  };
}, ["swiftwash-expense-ledger-v2"], { tags: [CACHE_TAGS.expenses], revalidate: 5 * 60 });

export function getExpenseLedger(page: number) {
  return getExpenseLedgerForPage(page);
}

const getPurchaseLedgerForQuery = unstable_cache(async (searchValue: string, page: number) => {
  const search = searchValue.trim().slice(0, 120);
  const matchingStatuses = (["DRAFT", "RECEIVED", "CANCELLED"] as const).filter((value) => value.toLowerCase().includes(search.toLowerCase()));
  const matchingPaymentStatuses = (["PAID", "UNPAID"] as const).filter((value) => value.toLowerCase().includes(search.toLowerCase()));
  const where: Prisma.PurchaseWhereInput = search ? { OR: [
    { supplier: { is: { name: { contains: search, mode: "insensitive" } } } },
    { supplierInvoiceNumber: { contains: search, mode: "insensitive" } },
    { notes: { contains: search, mode: "insensitive" } },
    { paymentMethod: { is: { name: { contains: search, mode: "insensitive" } } } },
    { items: { some: { inventoryItem: { is: { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] } } } } },
    ...matchingStatuses.map((status) => ({ status })),
    ...matchingPaymentStatuses.map((paymentStatus) => ({ paymentStatus })),
  ] } : {};
  const take = 25;
  const [rows, total] = await Promise.all([prisma.purchase.findMany({
    where, orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], skip: (page - 1) * take, take,
    select: {
      id: true, purchaseDate: true, supplierId: true, paymentMethodId: true, supplierInvoiceNumber: true,
      paymentStatus: true, notes: true, status: true, supplier: { select: { id: true, name: true } },
      items: { select: { id: true, inventoryItemId: true, quantity: true, unitCost: true, inventoryItem: { select: { id: true, name: true } } } },
    },
  }), prisma.purchase.count({ where })]);
  return { total, rows: rows.map((row) => ({
    id: row.id, supplierId: row.supplierId, paymentMethodId: row.paymentMethodId, paymentStatus: row.paymentStatus, notes: row.notes,
    purchaseDate: row.purchaseDate.toISOString(),
    supplier: row.supplier,
    supplierInvoiceNumber: row.supplierInvoiceNumber,
    status: row.status,
    items: row.items.map((item) => ({ id: item.id, inventoryItemId: item.inventoryItemId, inventoryItem: item.inventoryItem, quantity: item.quantity.toString(), unitCost: item.unitCost.toFixed(2) })),
    total: row.items.reduce((sum, item) => sum.add(item.quantity.mul(item.unitCost)), new Prisma.Decimal(0)).toFixed(2),
  })) };
}, ["swiftwash-purchase-ledger-v4"], { tags: [CACHE_TAGS.purchases], revalidate: 5 * 60 });

export function getPurchaseLedger(search = "", page = 1) {
  return getPurchaseLedgerForQuery(search, page);
}

const getIssueLedgerForQuery = unstable_cache(async (searchValue: string, statusValue: string, supervisorId: string, fromValue: string, toValue: string, page: number) => {
  const search = searchValue.trim().slice(0, 120);
  const where: Prisma.InventoryIssueWhereInput = {
    ...(statusValue ? { status: statusValue as "ISSUED" | "CLOSED" | "CANCELLED" } : {}),
    ...(supervisorId ? { supervisorUserId: supervisorId } : {}),
    ...(fromValue || toValue ? { issueDate: { gte: fromValue ? businessDateStart(fromValue) : undefined, lte: toValue ? businessDateEnd(toValue) : undefined } } : {}),
    ...(search ? { OR: [
      { supervisor: { is: { OR: [{ fullName: { contains: search, mode: "insensitive" } }, { username: { contains: search, mode: "insensitive" } }] } } },
      { notes: { contains: search, mode: "insensitive" } },
      { cancellationReason: { contains: search, mode: "insensitive" } },
      { items: { some: { OR: [{ inventoryItem: { is: { name: { contains: search, mode: "insensitive" } } } }, { inventoryItem: { is: { sku: { contains: search, mode: "insensitive" } } } }, { notes: { contains: search, mode: "insensitive" } }] } } },
    ] } : {}),
  };
  const take = 25;
  const [rows, total] = await Promise.all([
    prisma.inventoryIssue.findMany({
      where, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], skip: (page - 1) * take, take,
      select: { id: true, supervisorUserId: true, issueDate: true, status: true, notes: true, closedAt: true, cancelledAt: true, cancellationReason: true, supervisor: { select: { fullName: true } }, items: { orderBy: { inventoryItem: { name: "asc" } }, select: { id: true, inventoryItemId: true, quantityIssued: true, quantityReturned: true, quantityDamaged: true, quantityLost: true, conditionOut: true, conditionIn: true, notes: true, inventoryItem: { select: { name: true, sku: true, type: true, unit: true } } } } },
    }),
    prisma.inventoryIssue.count({ where }),
  ]);
  return { total, rows: rows.map((row) => ({ ...row, issueDate: row.issueDate.toISOString(), issueDateInput: businessDateInputValue(row.issueDate), closedAt: row.closedAt?.toISOString() ?? null, cancelledAt: row.cancelledAt?.toISOString() ?? null, items: row.items.map((item) => ({ ...item, quantityIssued: item.quantityIssued.toString(), quantityReturned: item.quantityReturned.toString(), quantityDamaged: item.quantityDamaged.toString(), quantityLost: item.quantityLost.toString() })) })) };
}, ["swiftwash-issue-ledger-v5"], { tags: [CACHE_TAGS.issues], revalidate: 5 * 60 });

export function getIssueLedger(search = "", status = "", supervisorId = "", from = "", to = "", page = 1) {
  return getIssueLedgerForQuery(search, status, supervisorId, from, to, page);
}

const getAuditLedgerForQuery = unstable_cache(async (action: string, entity: string, page: number) => {
  const take = 50;
  const where: Prisma.AuditLogWhereInput = { ...(action ? { action: { contains: action, mode: "insensitive" } } : {}), ...(entity ? { entityType: { contains: entity, mode: "insensitive" } } : {}) };
  const [rows, total, actionOptions, entityOptions] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, select: { id: true, createdAt: true, action: true, entityType: true, entityId: true, oldValues: true, newValues: true, ipAddress: true, userAgent: true, user: { select: { fullName: true, username: true } } } }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["action"], orderBy: { action: "asc" }, select: { action: true } }),
    prisma.auditLog.findMany({ distinct: ["entityType"], orderBy: { entityType: "asc" }, select: { entityType: true } }),
  ]);
  return {
    total,
    actions: actionOptions.map((option) => option.action),
    entities: entityOptions.map((option) => option.entityType),
    rows: rows.map((row) => ({ id: row.id, createdAt: row.createdAt.toISOString(), action: row.action, entityType: row.entityType, entityId: row.entityId, oldValues: row.oldValues, newValues: row.newValues, ipAddress: row.ipAddress, userAgent: row.userAgent, user: row.user })),
  };
}, ["swiftwash-audit-ledger-v4"], { tags: [CACHE_TAGS.audit], revalidate: 15 });

export function getAuditLedger(action: string | undefined, entity: string | undefined, page: number) {
  return getAuditLedgerForQuery(action?.trim() ?? "", entity?.trim() ?? "", page);
}

export const getCachedStockSnapshot = unstable_cache(async () => {
  const stock = await stockSnapshot();
  return stock.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    category: { id: row.category.id, name: row.category.name },
    sku: row.sku,
    name: row.name,
    type: row.type,
    unit: row.unit,
    description: row.description,
    minimumStockLevel: row.minimumStockLevel.toString(),
    owned: row.owned.toString(),
    assigned: row.assigned.toString(),
    available: row.available.toString(),
    low: row.available.lessThanOrEqualTo(row.minimumStockLevel),
  }));
}, ["swiftwash-stock-v1"], { tags: [CACHE_TAGS.inventory], revalidate: 5 * 60 });

const getDashboardSnapshotForPeriod = unstable_cache(async (todayIso: string, tomorrowIso: string, monthIso: string, nextMonthIso: string, todayLabel: string, monthLabel: string, monthRangeLabel: string, timeZone: string) => {
  const today = new Date(todayIso); const tomorrow = new Date(tomorrowIso); const month = new Date(monthIso); const nextMonth = new Date(nextMonthIso);
  const todayRange = { gte: today, lt: tomorrow };
  const monthRange = { gte: month, lt: nextMonth };
  const [todaySales, monthSales, recent, catalog, todayExpenses, monthExpenses, monthPurchases, stock, byPayment, byService, bySupervisor, movements, users] = await Promise.all([
    prisma.receipt.aggregate({ where: { status: "COMPLETED", issuedAt: todayRange }, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.aggregate({ where: { status: "COMPLETED", issuedAt: monthRange }, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.findMany({ select: { id: true, status: true, serviceNameSnapshot: true, servicePriceSnapshot: true, issuedAt: true, createdByUser: { select: { fullName: true } } }, orderBy: [{ issuedAt: "desc" }, { id: "desc" }], take: 7 }),
    getCatalogData(),
    prisma.expense.aggregate({ where: { status: "ACTIVE", expenseDate: todayRange }, _count: true, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { status: "ACTIVE", expenseDate: monthRange }, _count: true, _sum: { amount: true } }),
    prisma.purchase.findMany({ where: { status: "RECEIVED", purchaseDate: monthRange }, select: { items: { select: { quantity: true, unitCost: true } } } }),
    getCachedStockSnapshot(),
    prisma.receipt.groupBy({ by: ["paymentMethodId"], where: { status: "COMPLETED", issuedAt: todayRange }, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.groupBy({ by: ["serviceNameSnapshot"], where: { status: "COMPLETED", issuedAt: todayRange }, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.groupBy({ by: ["createdByUserId"], where: { status: "COMPLETED", issuedAt: todayRange }, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.inventoryMovement.findMany({ select: { id: true, movementType: true, quantity: true, inventoryItem: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.user.findMany({ select: { id: true, fullName: true } }),
  ]);
  const zero = new Prisma.Decimal(0);
  const methodNames = new Map(catalog.methods.map((row) => [row.id, row.name]));
  const userNames = new Map(users.map((row) => [row.id, row.fullName]));
  const purchaseTotal = monthPurchases.reduce((total, purchase) => purchase.items.reduce((purchaseSum, row) => purchaseSum.add(row.quantity.mul(row.unitCost)), total), zero);
  return {
    currency: catalog.settings?.currencyCode ?? "USD",
    period: { todayLabel, monthLabel, monthRangeLabel, timeZone },
    todaySales: { count: todaySales._count, total: (todaySales._sum.servicePriceSnapshot ?? zero).toFixed(2) },
    monthSales: { count: monthSales._count, total: (monthSales._sum.servicePriceSnapshot ?? zero).toFixed(2) },
    todayExpenses: { count: todayExpenses._count, total: (todayExpenses._sum.amount ?? zero).toFixed(2) },
    monthExpenses: { count: monthExpenses._count, total: (monthExpenses._sum.amount ?? zero).toFixed(2) },
    monthPurchases: { count: monthPurchases.length, total: purchaseTotal.toFixed(2) },
    recent: recent.map((row) => ({ id: row.id, status: row.status, service: row.serviceNameSnapshot, total: row.servicePriceSnapshot.toFixed(2), issuedAt: row.issuedAt.toISOString(), supervisor: row.createdByUser.fullName })),
    stock,
    byPayment: byPayment.map((row) => ({ name: methodNames.get(row.paymentMethodId) ?? "Unknown", count: row._count, total: (row._sum.servicePriceSnapshot ?? zero).toFixed(2) })),
    byService: byService.map((row) => ({ name: row.serviceNameSnapshot, count: row._count, total: (row._sum.servicePriceSnapshot ?? zero).toFixed(2) })),
    bySupervisor: bySupervisor.map((row) => ({ name: userNames.get(row.createdByUserId) ?? "Unknown", count: row._count, total: (row._sum.servicePriceSnapshot ?? zero).toFixed(2) })),
    movements: movements.map((row) => ({ id: row.id, item: row.inventoryItem.name, type: row.movementType, quantity: row.quantity.toString() })),
  };
}, ["swiftwash-dashboard-v2"], { tags: [CACHE_TAGS.dashboard, CACHE_TAGS.catalog, CACHE_TAGS.inventory], revalidate: 5 * 60 });

export function getDashboardSnapshot() {
  const periods = getBusinessPeriods();
  return getDashboardSnapshotForPeriod(periods.todayStart.toISOString(), periods.tomorrowStart.toISOString(), periods.monthStart.toISOString(), periods.nextMonthStart.toISOString(), periods.todayLabel, periods.monthLabel, periods.monthRangeLabel, periods.timeZone);
}

const getReportSnapshotForRange = unstable_cache(async (startIso: string, endIso: string, supervisorId: string) => {
  const start = new Date(startIso); const end = new Date(endIso); const selectedId = supervisorId || undefined;
  const receiptWhere: Prisma.ReceiptWhereInput = { issuedAt: { gte: start, lte: end }, ...(selectedId ? { createdByUserId: selectedId } : {}) };
  const completedReceiptWhere: Prisma.ReceiptWhereInput = { ...receiptWhere, status: "COMPLETED" };
  const expenseWhere: Prisma.ExpenseWhereInput = { expenseDate: { gte: start, lte: end }, ...(selectedId ? { supervisorUserId: selectedId } : {}) };
  const paidExpenseWhere: Prisma.ExpenseWhereInput = { ...expenseWhere, status: "ACTIVE", paymentStatus: "PAID" };
  const movementWhere: Prisma.InventoryMovementWhereInput = { createdAt: { gte: start, lte: end }, ...(selectedId ? { inventoryIssueItem: { inventoryIssue: { supervisorUserId: selectedId } } } : {}) };
  const issueWhere: Prisma.InventoryIssueWhereInput = { issueDate: { gte: start, lte: end }, ...(selectedId ? { supervisorUserId: selectedId } : {}) };
  const [receipts, expenses, purchaseSummary, movements, issueCount, issueRows, stock, catalog, salesSummary, expenseSummary, serviceGroups, supervisorGroups, paymentGroups, users] = await Promise.all([
    prisma.receipt.findMany({ where: receiptWhere, select: { id: true, issuedAt: true, serviceNameSnapshot: true, servicePriceSnapshot: true, status: true, createdByUser: { select: { fullName: true } } }, orderBy: { issuedAt: "desc" }, take: 25 }),
    prisma.expense.findMany({ where: expenseWhere, select: { id: true, expenseDate: true, type: true, title: true, amount: true, status: true }, orderBy: { expenseDate: "desc" }, take: 25 }),
    selectedId ? Promise.resolve({ count: 0, lineCount: 0, total: "0.00", paidTotal: "0.00", unpaidTotal: "0.00" }) : getPurchaseSummary(start, end),
    prisma.inventoryMovement.findMany({ where: movementWhere, select: { id: true, createdAt: true, movementType: true, quantity: true, inventoryItem: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.inventoryIssue.count({ where: issueWhere }),
    prisma.inventoryIssue.findMany({ where: issueWhere, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], take: 25, select: { id: true, issueDate: true, status: true, supervisor: { select: { fullName: true } }, items: { select: { quantityIssued: true, quantityReturned: true, quantityDamaged: true, quantityLost: true, inventoryItem: { select: { name: true, type: true, unit: true } } } } } }),
    getCachedStockSnapshot(),
    getCatalogData(),
    prisma.receipt.aggregate({ where: completedReceiptWhere, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.expense.aggregate({ where: paidExpenseWhere, _count: true, _sum: { amount: true } }),
    prisma.receipt.groupBy({ by: ["serviceNameSnapshot"], where: completedReceiptWhere, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.groupBy({ by: ["createdByUserId"], where: completedReceiptWhere, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.groupBy({ by: ["paymentMethodId"], where: completedReceiptWhere, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.user.findMany({ select: { id: true, fullName: true } }),
  ]);
  const zero = new Prisma.Decimal(0);
  const sales = salesSummary._sum.servicePriceSnapshot ?? zero;
  const expenseTotal = expenseSummary._sum.amount ?? zero;
  const paidPurchaseTotal = new Prisma.Decimal(purchaseSummary.paidTotal);
  const userNames = new Map(users.map((row) => [row.id, row.fullName]));
  const methodNames = new Map(catalog.methods.map((row) => [row.id, row.name]));
  return {
    currency: catalog.settings?.currencyCode ?? "USD",
    sales: { count: salesSummary._count, total: sales.toFixed(2) },
    expenses: { count: expenseSummary._count, total: expenseTotal.toFixed(2) },
    purchases: purchaseSummary,
    cash: sales.sub(expenseTotal).sub(paidPurchaseTotal).toFixed(2),
    receipts: receipts.map((row) => ({ id: row.id, issuedAt: row.issuedAt.toISOString(), service: row.serviceNameSnapshot, supervisor: row.createdByUser.fullName, total: row.servicePriceSnapshot.toFixed(2), status: row.status })),
    expenseRows: expenses.map((row) => ({ id: row.id, expenseDate: row.expenseDate.toISOString(), type: row.type, title: row.title, amount: row.amount.toFixed(2), status: row.status })),
    movements: movements.map((row) => ({ id: row.id, createdAt: row.createdAt.toISOString(), item: row.inventoryItem.name, type: row.movementType, quantity: row.quantity.toString() })),
    issueCount,
    issueRows: issueRows.map((row) => ({ id: row.id, issueDate: row.issueDate.toISOString(), status: row.status, supervisor: row.supervisor.fullName, items: row.items.map((line) => ({ item: line.inventoryItem.name, type: line.inventoryItem.type, unit: line.inventoryItem.unit, issued: line.quantityIssued.toString(), returned: line.quantityReturned.toString(), consumed: line.inventoryItem.type === "CONSUMABLE" ? line.quantityIssued.sub(line.quantityReturned).toString() : "0", damaged: line.quantityDamaged.toString(), lost: line.quantityLost.toString() })) })),
    stock,
    byService: serviceGroups.map((row) => ({ name: row.serviceNameSnapshot, count: row._count, total: (row._sum.servicePriceSnapshot ?? zero).toFixed(2) })),
    bySupervisor: supervisorGroups.map((row) => ({ name: userNames.get(row.createdByUserId) ?? "Unknown", count: row._count, total: (row._sum.servicePriceSnapshot ?? zero).toFixed(2) })),
    byPayment: paymentGroups.map((row) => ({ name: methodNames.get(row.paymentMethodId) ?? "Unknown", count: row._count, total: (row._sum.servicePriceSnapshot ?? zero).toFixed(2) })),
  };
}, ["swiftwash-report-v1"], { tags: [CACHE_TAGS.reports, CACHE_TAGS.catalog, CACHE_TAGS.inventory], revalidate: 5 * 60 });

async function getPurchaseSummary(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<{ count: bigint; line_count: bigint; total: Prisma.Decimal | null; paid_total: Prisma.Decimal | null; unpaid_total: Prisma.Decimal | null }[]>`
    SELECT
      COUNT(DISTINCT p.id)::bigint AS count,
      COUNT(pi.id)::bigint AS line_count,
      COALESCE(SUM(pi.quantity * pi."unitCost"), 0) AS total,
      COALESCE(SUM(CASE WHEN p."paymentStatus" = 'PAID'::"FinancialStatus" THEN pi.quantity * pi."unitCost" ELSE 0 END), 0) AS paid_total,
      COALESCE(SUM(CASE WHEN p."paymentStatus" = 'UNPAID'::"FinancialStatus" THEN pi.quantity * pi."unitCost" ELSE 0 END), 0) AS unpaid_total
    FROM "PurchaseItem" pi
    INNER JOIN "Purchase" p ON p.id = pi."purchaseId"
    WHERE p.status = 'RECEIVED'::"PurchaseStatus"
      AND p."purchaseDate" >= ${start}
      AND p."purchaseDate" <= ${end}
  `;
  const zero = new Prisma.Decimal(0);
  return {
    count: Number(rows[0]?.count ?? 0),
    lineCount: Number(rows[0]?.line_count ?? 0),
    total: (rows[0]?.total ?? zero).toFixed(2),
    paidTotal: (rows[0]?.paid_total ?? zero).toFixed(2),
    unpaidTotal: (rows[0]?.unpaid_total ?? zero).toFixed(2),
  };
}

export function getReportSnapshot(start: Date, end: Date, supervisorId?: string) {
  return getReportSnapshotForRange(start.toISOString(), end.toISOString(), supervisorId ?? "");
}
