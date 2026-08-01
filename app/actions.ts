"use server";

import { Prisma, type UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { CACHE_TAGS } from "@/lib/cached-data";
import { businessDateStart } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireManagement, requireUser } from "@/lib/session";
import { booleanInput, cancellationInput, cuidInput, passwordChangeInput, paymentMethodInput, positiveIntegerInput, serviceInput, serviceUpdateInput, settingsInput, supervisorInput, supervisorUpdateInput } from "@/lib/validation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { cancelReceipt, recordReprint } from "@/modules/receipts/service";
import { cancelExpense, createExpense, deleteExpense, updateExpense } from "@/modules/expenses/service";
import { adjustStock, cancelInventoryIssue, closeInventoryIssue, deleteInventoryIssue, issueInventory, reconcileStocktake, updateInventoryIssue } from "@/modules/inventory/service";
import { createInventoryCategory, createInventoryItem, createSupplier, deleteInventoryCategory, deleteInventoryItem, deleteSupplier, updateInventoryCategory, updateInventoryItem, updateSupplier } from "@/modules/inventory/catalog";
import { createPurchase, deletePurchase, receivePurchase, updatePurchase } from "@/modules/purchases/service";

function value(form: FormData, key: string) { return String(form.get(key) ?? ""); }
function optionalDate(form: FormData, key: string) { const v = value(form, key); return v ? businessDateStart(v) : undefined; }
function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "The request could not be completed.";
  if (error.message.startsWith("OVERRIDE_REQUIRED:")) return `Commission exceeds the ${error.message.split(":")[1]} completed receipts. Add an override reason to continue.`;
  if (error.message.startsWith("INSUFFICIENT_STOCK_DETAIL:")) {
    try {
      const detail = JSON.parse(error.message.slice("INSUFFICIENT_STOCK_DETAIL:".length)) as { name: string; available: string; unit: string };
      return `${detail.name} has only ${detail.available} ${detail.unit} available. Reduce the quantity or receive more stock.`;
    } catch { return "Not enough available stock."; }
  }
  const messages: Record<string, string> = {
    INSUFFICIENT_STOCK: "Not enough available stock.", PURCHASE_NOT_RECEIVABLE: "This purchase has already been received or is not ready.", PURCHASE_ALREADY_RECEIVED: "This purchase was already received.",
    EXPENSE_NOT_FOUND: "This expense no longer exists.", EXPENSE_NOT_EDITABLE: "Cancelled expenses cannot be edited.",
    PURCHASE_NOT_FOUND: "This purchase no longer exists.", PURCHASE_NOT_EDITABLE: "Only draft purchases can be edited.",
    PURCHASE_NOT_DELETABLE: "Only draft purchases can be deleted. Received purchases are locked because stock was already posted.",
    REUSABLE_ITEMS_MUST_BE_ACCOUNTED_FOR: "All reusable items must be returned, damaged, or lost before closing.",
    QUANTITY_EXCEEDS_ISSUED: "Returned, damaged, and lost quantities exceed the issued quantity.",
    ISSUE_NOT_OPEN: "This inventory issue is already closed or no longer available.", ITEM_OR_SUPERVISOR_UNAVAILABLE: "Choose an active supervisor and inventory item.",
    ISSUE_NOT_FOUND: "This handover no longer exists.", ISSUE_NOT_EDITABLE: "Only an open handover can be updated.",
    ISSUE_NOT_DELETABLE: "Only an open handover can be deleted. Closed handovers remain locked for accurate history.",
    ISSUE_NOT_CANCELLABLE: "Only an open handover can be cancelled.", ISSUE_LINES_INCOMPLETE: "Complete every item in this handover before closing.",
    CONSUMABLE_CONDITION_INVALID: "Consumable items must be issued in usable condition.", CONSUMABLE_OUTCOME_INVALID: "Consumables can only be returned or recorded as used.",
    LOSS_DAMAGE_REASON_REQUIRED: "Add a reason for every damaged or lost item.", STOCKTAKE_NO_VARIANCE: "The counted quantity already matches the system quantity.",
    INVENTORY_CATEGORY_NOT_FOUND: "This category no longer exists.", INVENTORY_CATEGORY_UNAVAILABLE: "Choose an available inventory category.",
    INVENTORY_CATEGORY_NOT_DELETABLE: "This category contains inventory items. Archive it instead of deleting it.",
    INVENTORY_ITEM_NOT_FOUND: "This inventory item no longer exists.", INVENTORY_ITEM_NOT_DELETABLE: "This item has stock or transaction history. Archive it instead of deleting it.",
    INVENTORY_ITEM_TRACKING_LOCKED: "Type and unit cannot change after an item has stock history.",
    SUPPLIER_NOT_FOUND: "This supplier no longer exists.", SUPPLIER_NOT_DELETABLE: "This supplier has purchase history. Archive it instead of deleting it.",
  };
  return messages[error.message] ?? "Check the form values and try again.";
}

function expenseFormData(form: FormData) {
  return { type: value(form, "type"), title: value(form, "title"), expenseDate: businessDateStart(value(form, "expenseDate")), categoryId: value(form, "categoryId"), supervisorUserId: value(form, "supervisorUserId"), paymentMethodId: value(form, "paymentMethodId"), paymentStatus: value(form, "paymentStatus"), amount: value(form, "amount") || undefined, carCount: value(form, "carCount") || undefined, ratePerCar: value(form, "ratePerCar") || undefined, periodStart: optionalDate(form, "periodStart"), periodEnd: optionalDate(form, "periodEnd"), paymentReference: value(form, "paymentReference"), notes: value(form, "notes"), overrideReason: value(form, "overrideReason") };
}

function purchaseFormData(form: FormData) {
  return { supplierId: value(form, "supplierId"), paymentMethodId: value(form, "paymentMethodId"), supplierInvoiceNumber: value(form, "supplierInvoiceNumber"), purchaseDate: businessDateStart(value(form, "purchaseDate")), paymentStatus: value(form, "paymentStatus"), items: jsonArray(form, "itemsJson"), notes: value(form, "notes") };
}

function jsonArray(form: FormData, key: string): unknown[] {
  try { const parsed: unknown = JSON.parse(value(form, key)); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

function inventoryItemFormData(form: FormData) {
  return { categoryId: value(form, "categoryId"), sku: value(form, "sku"), name: value(form, "name"), type: value(form, "type"), unit: value(form, "unit"), minimumStockLevel: value(form, "minimumStockLevel"), description: value(form, "description") };
}

function canManageStaffAccount(operatorRole: UserRole, targetRole: UserRole) {
  return operatorRole === "ADMIN" || targetRole === "SUPERVISOR";
}

export async function createServiceAction(form: FormData) {
  const admin = await requireManagement();
  try {
    const data = serviceInput.parse({ name: value(form, "name"), price: value(form, "price"), description: value(form, "description") });
    const service = await prisma.service.create({ data: { ...data, price: new Prisma.Decimal(data.price) } });
    await prisma.auditLog.create({ data: { userId: admin.id, action: "SERVICE_CREATED", entityType: "Service", entityId: service.id } });
  } catch { redirect("/services?error=Unable+to+create+service"); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.catalog); redirect("/services?success=Service+created");
}

export async function updateServiceAction(form: FormData) {
  const admin = await requireManagement();
  const parsed = serviceUpdateInput.safeParse({ id: value(form, "id"), name: value(form, "name"), price: value(form, "price"), description: value(form, "description"), isActive: value(form, "isActive") });
  if (!parsed.success) redirect("/services?error=Check+the+service+name,+price,+description,+and+status");
  const current = await prisma.service.findUnique({ where: { id: parsed.data.id } });
  if (!current) redirect("/services?error=Service+not+found");
  const price = new Prisma.Decimal(parsed.data.price); const description = parsed.data.description ?? null;
  const changed = current.name !== parsed.data.name || !current.price.equals(price) || current.description !== description || current.isActive !== parsed.data.isActive;
  if (!changed) redirect("/services?success=No+changes+needed");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.service.update({ where: { id: current.id }, data: { name: parsed.data.name, price, description, isActive: parsed.data.isActive } });
      await tx.auditLog.create({ data: { userId: admin.id, action: current.price.equals(price) ? "SERVICE_UPDATED" : "SERVICE_PRICE_CHANGED", entityType: "Service", entityId: current.id, oldValues: { name: current.name, price: current.price.toFixed(2), description: current.description, isActive: current.isActive }, newValues: { name: parsed.data.name, price: price.toFixed(2), description, isActive: parsed.data.isActive } } });
    });
  } catch { redirect("/services?error=Service+name+may+already+exist+or+the+update+could+not+be+saved"); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.catalog); redirect("/services?success=Service+updated");
}

export async function createPaymentMethodAction(form: FormData) {
  const admin = await requireManagement(); const data = paymentMethodInput.parse({ name: value(form, "name") });
  const method = await prisma.paymentMethod.create({ data });
  await prisma.auditLog.create({ data: { userId: admin.id, action: "PAYMENT_METHOD_CREATED", entityType: "PaymentMethod", entityId: method.id } });
  updateTag(CACHE_TAGS.catalog); redirect("/services?success=Payment+method+created");
}

export async function togglePaymentMethodAction(form: FormData) {
  const operator = await requireManagement();
  const id = cuidInput.parse(value(form, "id"));
  const isActive = booleanInput.parse(value(form, "isActive"));
  await prisma.$transaction([
    prisma.paymentMethod.update({ where: { id }, data: { isActive } }),
    prisma.auditLog.create({ data: { userId: operator.id, action: isActive ? "PAYMENT_METHOD_ENABLED" : "PAYMENT_METHOD_DISABLED", entityType: "PaymentMethod", entityId: id } }),
  ]);
  updateTag(CACHE_TAGS.catalog); refresh();
}

export async function createSupervisorAction(form: FormData) {
  const operator = await requireManagement();
  const parsed = supervisorInput.safeParse({ fullName: value(form, "fullName"), username: value(form, "username"), password: value(form, "password"), role: value(form, "role") });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message = field === "fullName"
      ? "Enter the staff member's full name."
      : field === "username"
        ? "Username must be 3–30 letters, numbers, dots, or underscores."
        : field === "role"
          ? "Choose Manager or Supervisor access."
          : "Password must have 12+ characters, uppercase, lowercase, a number, and a symbol.";
    redirect(`/supervisors?error=${encodeURIComponent(message)}`);
  }
  const data = parsed.data;
  if (!canManageStaffAccount(operator.role, data.role)) redirect("/supervisors?error=Managers+can+only+create+supervisor+accounts");
  const username = data.username.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (existing) redirect(`/supervisors?error=${encodeURIComponent(`Username @${username} already exists. Choose a different username.`)}`);
  try {
    const password = await hashPassword(data.password);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: data.fullName, fullName: data.fullName, email: `${username}@users.swiftwash.invalid`, username, displayUsername: data.username, role: data.role } });
      await tx.account.create({ data: { providerId: "credential", accountId: user.id, userId: user.id, password } });
      await tx.auditLog.create({ data: { userId: operator.id, action: "USER_CREATED", entityType: "User", entityId: user.id, newValues: { role: data.role, username } } });
    });
  } catch { redirect("/supervisors?error=The+staff+account+could+not+be+created.+Please+try+again"); }
  updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.supervisors); redirect("/supervisors?success=Staff+account+created+successfully");
}

export async function toggleSupervisorAction(form: FormData) {
  const operator = await requireManagement(); const id = cuidInput.parse(value(form, "id")); const isActive = booleanInput.parse(value(form, "isActive"));
  const staff = await prisma.user.findFirst({ where: { id, role: { in: ["SUPERVISOR", "MANAGER"] } }, select: { id: true, role: true } });
  if (!staff) redirect("/supervisors?error=Staff+account+not+found");
  if (!canManageStaffAccount(operator.role, staff.role)) redirect("/supervisors?error=Only+an+administrator+can+manage+manager+accounts");
  await prisma.$transaction([prisma.user.update({ where: { id: staff.id }, data: { isActive } }), prisma.session.deleteMany({ where: { userId: staff.id } }), prisma.auditLog.create({ data: { userId: operator.id, action: isActive ? "USER_ENABLED" : "USER_DISABLED", entityType: "User", entityId: staff.id } })]);
  updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.supervisors); redirect(`/supervisors?success=Staff+account+${isActive ? "enabled" : "disabled"}+successfully`);
}

export async function updateSupervisorAction(form: FormData) {
  const operator = await requireManagement();
  const parsed = supervisorUpdateInput.safeParse({ id: value(form, "id"), fullName: value(form, "fullName"), username: value(form, "username"), password: value(form, "password"), role: value(form, "role") });
  if (!parsed.success) redirect("/supervisors?error=Check+the+name,+username,+role,+and+password+requirements");
  const current = await prisma.user.findFirst({ where: { id: parsed.data.id, role: { in: ["SUPERVISOR", "MANAGER"] } }, select: { id: true, fullName: true, username: true, role: true } });
  if (!current) redirect("/supervisors?error=Staff+account+not+found");
  if (!canManageStaffAccount(operator.role, current.role) || !canManageStaffAccount(operator.role, parsed.data.role)) redirect("/supervisors?error=Only+an+administrator+can+manage+manager+accounts");
  try {
    const username = parsed.data.username.toLowerCase();
    const password = parsed.data.password ? await hashPassword(parsed.data.password) : undefined;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: current.id }, data: { name: parsed.data.fullName, fullName: parsed.data.fullName, username, displayUsername: parsed.data.username, email: `${username}@users.swiftwash.invalid`, role: parsed.data.role } });
      if (password) await tx.account.updateMany({ where: { userId: current.id, providerId: "credential" }, data: { password } });
      await tx.session.deleteMany({ where: { userId: current.id } });
      await tx.auditLog.create({ data: { userId: operator.id, action: "USER_UPDATED", entityType: "User", entityId: current.id, oldValues: { fullName: current.fullName, username: current.username, role: current.role }, newValues: { fullName: parsed.data.fullName, username, role: parsed.data.role, passwordReset: Boolean(password) } } });
    });
  } catch {
    redirect("/supervisors?error=Username+may+already+exist+or+the+account+could+not+be+updated");
  }
  updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.supervisors); updateTag(CACHE_TAGS.reports); redirect("/supervisors?success=Staff+account+updated+successfully");
}

export async function deleteSupervisorAction(form: FormData) {
  const operator = await requireManagement(); const id = cuidInput.parse(value(form, "id"));
  const current = await prisma.user.findFirst({
    where: { id, role: { in: ["SUPERVISOR", "MANAGER"] } },
    select: {
      id: true, fullName: true, username: true, role: true,
      _count: { select: { receiptsCreated: true, receiptsCancelled: true, receiptReprints: true, expensesForSupervisor: true, expensesCreated: true, expensesCancelled: true, purchasesCreated: true, issuesReceived: true, issuesCreated: true, movementsCreated: true, auditLogs: true } },
    },
  });
  if (!current) redirect("/supervisors?error=Staff+account+not+found");
  if (!canManageStaffAccount(operator.role, current.role)) redirect("/supervisors?error=Only+an+administrator+can+manage+manager+accounts");
  if (Object.values(current._count).some((count) => count > 0)) redirect("/supervisors?error=This+account+has+business+history.+Disable+it+instead");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { userId: operator.id, action: "USER_DELETED", entityType: "User", entityId: current.id, oldValues: { fullName: current.fullName, username: current.username, role: current.role } } });
      await tx.user.delete({ where: { id: current.id } });
    });
  } catch {
    redirect("/supervisors?error=Staff+account+could+not+be+deleted.+Disable+it+instead");
  }
  updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.supervisors); updateTag(CACHE_TAGS.reports); redirect("/supervisors?success=Staff+account+deleted+successfully");
}

export async function cancelReceiptAction(form: FormData) {
  const admin = await requireManagement();
  try { const data = cancellationInput.parse({ id: value(form, "id"), reason: value(form, "reason") }); await cancelReceipt(data.id, data.reason, admin); }
  catch { redirect("/receipts?error=Receipt+could+not+be+cancelled"); }
  updateTag(CACHE_TAGS.dashboard); updateTag(CACHE_TAGS.receipts); updateTag(CACHE_TAGS.reports); redirect("/receipts?success=Receipt+cancelled");
}

export async function reprintReceiptAction(form: FormData) {
  const user = await requireUser(); const id = positiveIntegerInput.parse(value(form, "id")); await recordReprint(id, user); redirect(`/receipts/${id}/print?autoprint=1`);
}

export async function createExpenseAction(form: FormData) {
  const admin = await requireManagement();
  try {
    await createExpense(expenseFormData(form), admin.id);
  } catch (error) { redirect(`/expenses?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.dashboard); updateTag(CACHE_TAGS.expenses); updateTag(CACHE_TAGS.reports); redirect("/expenses?success=Expense+recorded+successfully");
}

export async function updateExpenseAction(form: FormData) {
  const admin = await requireManagement();
  try { await updateExpense(cuidInput.parse(value(form, "id")), expenseFormData(form), admin.id); }
  catch (error) { redirect(`/expenses?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.dashboard); updateTag(CACHE_TAGS.expenses); updateTag(CACHE_TAGS.reports); redirect("/expenses?success=Expense+updated+successfully");
}

export async function deleteExpenseAction(form: FormData) {
  const admin = await requireManagement();
  try { await deleteExpense(cuidInput.parse(value(form, "id")), admin.id); }
  catch (error) { redirect(`/expenses?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.dashboard); updateTag(CACHE_TAGS.expenses); updateTag(CACHE_TAGS.reports); redirect("/expenses?success=Expense+deleted+successfully");
}

export async function cancelExpenseAction(form: FormData) {
  const admin = await requireManagement();
  try { await cancelExpense(cuidInput.parse(value(form, "id")), value(form, "reason"), admin.id); } catch { redirect("/expenses?error=Expense+could+not+be+cancelled"); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.dashboard); updateTag(CACHE_TAGS.expenses); updateTag(CACHE_TAGS.reports); redirect("/expenses?success=Expense+cancelled");
}

export async function createSupplierAction(form: FormData) {
  const admin = await requireManagement();
  try { await createSupplier({ name: value(form, "name"), phone: value(form, "phone"), email: value(form, "email"), address: value(form, "address"), notes: value(form, "notes") }, admin.id); }
  catch { redirect("/inventory/suppliers?error=Check+the+supplier+details.+The+name+may+already+exist"); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.reference); redirect("/inventory/suppliers?success=Supplier+created+successfully");
}

export async function createInventoryCategoryAction(form: FormData) {
  const admin = await requireManagement();
  try { await createInventoryCategory({ name: value(form, "name") }, admin.id); }
  catch { redirect("/inventory/categories?error=Check+the+category+name.+It+may+already+exist"); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.inventory); redirect("/inventory/categories?success=Category+created+successfully");
}

export async function createInventoryItemAction(form: FormData) {
  const admin = await requireManagement();
  try { await createInventoryItem(inventoryItemFormData(form), admin.id); }
  catch { redirect("/inventory/items?error=Check+the+item+details.+The+name+or+SKU+may+already+exist"); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.inventory); redirect("/inventory/items?success=Inventory+item+created+successfully");
}

export async function updateSupplierAction(form: FormData) {
  const admin = await requireManagement();
  try { await updateSupplier({ id: value(form, "id"), name: value(form, "name"), phone: value(form, "phone"), email: value(form, "email"), address: value(form, "address"), notes: value(form, "notes"), isActive: value(form, "isActive") }, admin.id); }
  catch (error) { redirect(`/inventory/suppliers?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.purchases); redirect("/inventory/suppliers?success=Supplier+updated+successfully");
}

export async function deleteSupplierAction(form: FormData) {
  const admin = await requireManagement();
  try { await deleteSupplier(cuidInput.parse(value(form, "id")), admin.id); }
  catch (error) { redirect(`/inventory/suppliers?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.purchases); redirect("/inventory/suppliers?success=Supplier+deleted+successfully");
}

export async function updateInventoryCategoryAction(form: FormData) {
  const admin = await requireManagement();
  try { await updateInventoryCategory({ id: value(form, "id"), name: value(form, "name"), isActive: value(form, "isActive") }, admin.id); }
  catch (error) { redirect(`/inventory/categories?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.inventory); redirect("/inventory/categories?success=Category+updated+successfully");
}

export async function deleteInventoryCategoryAction(form: FormData) {
  const admin = await requireManagement();
  try { await deleteInventoryCategory(cuidInput.parse(value(form, "id")), admin.id); }
  catch (error) { redirect(`/inventory/categories?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.inventory); redirect("/inventory/categories?success=Category+deleted+successfully");
}

export async function updateInventoryItemAction(form: FormData) {
  const admin = await requireManagement();
  try { await updateInventoryItem({ ...inventoryItemFormData(form), id: value(form, "id"), isActive: value(form, "isActive") }, admin.id); }
  catch (error) { redirect(`/inventory/items?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.inventory); redirect("/inventory/items?success=Inventory+item+updated+successfully");
}

export async function deleteInventoryItemAction(form: FormData) {
  const admin = await requireManagement();
  try { await deleteInventoryItem(cuidInput.parse(value(form, "id")), admin.id); }
  catch (error) { redirect(`/inventory/items?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.reference); updateTag(CACHE_TAGS.inventory); redirect("/inventory/items?success=Inventory+item+deleted+successfully");
}

export async function adjustStockAction(form: FormData) {
  const admin = await requireManagement();
  try { await adjustStock({ inventoryItemId: value(form, "inventoryItemId"), direction: value(form, "direction"), quantity: value(form, "quantity"), reason: value(form, "reason") }, admin.id); }
  catch (error) { redirect(`/inventory?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.inventory); redirect("/inventory?success=Stock+adjusted");
}

export async function reconcileStocktakeAction(form: FormData) {
  const admin = await requireManagement();
  try { await reconcileStocktake({ inventoryItemId: value(form, "inventoryItemId"), countedAvailable: value(form, "countedAvailable"), reason: value(form, "reason") }, admin.id); }
  catch (error) { redirect(`/inventory?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.inventory); updateTag(CACHE_TAGS.reports); redirect("/inventory?success=Physical+stock+count+reconciled+successfully");
}

export async function createPurchaseAction(form: FormData) {
  const admin = await requireManagement();
  try { await createPurchase(purchaseFormData(form), admin.id); }
  catch { redirect("/purchases?error=Purchase+could+not+be+created"); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.purchases); redirect("/purchases?success=Draft+purchase+created+successfully");
}

export async function updatePurchaseAction(form: FormData) {
  const admin = await requireManagement();
  try { await updatePurchase(cuidInput.parse(value(form, "id")), purchaseFormData(form), admin.id); }
  catch (error) { redirect(`/purchases?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.purchases); redirect("/purchases?success=Draft+purchase+updated+successfully");
}

export async function deletePurchaseAction(form: FormData) {
  const admin = await requireManagement();
  try { await deletePurchase(cuidInput.parse(value(form, "id")), admin.id); }
  catch (error) { redirect(`/purchases?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.purchases); redirect("/purchases?success=Draft+purchase+deleted+successfully");
}

export async function receivePurchaseAction(form: FormData) {
  const admin = await requireManagement();
  try { await receivePurchase(cuidInput.parse(value(form, "id")), admin.id); } catch (error) { redirect(`/purchases?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.inventory); updateTag(CACHE_TAGS.purchases); redirect("/purchases?success=Purchase+received+and+stock+updated+successfully");
}

export async function issueInventoryAction(form: FormData) {
  const admin = await requireManagement();
  try { await issueInventory({ supervisorUserId: value(form, "supervisorUserId"), issueDate: businessDateStart(value(form, "issueDate")), items: jsonArray(form, "itemsJson"), notes: value(form, "notes") }, admin.id); }
  catch (error) { redirect(`/inventory/issues?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.inventory); updateTag(CACHE_TAGS.issues); updateTag(CACHE_TAGS.reports); redirect("/inventory/issues?success=Daily+inventory+handover+created+successfully");
}

export async function updateIssueAction(form: FormData) {
  const admin = await requireManagement();
  try { await updateInventoryIssue({ id: value(form, "id"), supervisorUserId: value(form, "supervisorUserId"), issueDate: businessDateStart(value(form, "issueDate")), items: jsonArray(form, "itemsJson"), notes: value(form, "notes") }, admin.id); }
  catch (error) { redirect(`/inventory/issues?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.inventory); updateTag(CACHE_TAGS.issues); updateTag(CACHE_TAGS.reports); redirect("/inventory/issues?success=Daily+inventory+handover+updated+successfully");
}

export async function deleteIssueAction(form: FormData) {
  const admin = await requireManagement();
  try { await deleteInventoryIssue(cuidInput.parse(value(form, "id")), admin.id); }
  catch (error) { redirect(`/inventory/issues?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.inventory); updateTag(CACHE_TAGS.issues); updateTag(CACHE_TAGS.reports); redirect("/inventory/issues?success=Open+handover+deleted+and+stock+restored+successfully");
}

export async function closeIssueAction(form: FormData) {
  const admin = await requireManagement();
  try { await closeInventoryIssue({ issueId: value(form, "issueId"), items: jsonArray(form, "outcomesJson") }, admin.id); }
  catch (error) { redirect(`/inventory/issues?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.inventory); updateTag(CACHE_TAGS.issues); updateTag(CACHE_TAGS.reports); redirect("/inventory/issues?success=End-of-day+inventory+reconciliation+completed");
}

export async function cancelIssueAction(form: FormData) {
  const admin = await requireManagement();
  try { await cancelInventoryIssue({ id: value(form, "id"), reason: value(form, "reason") }, admin.id); }
  catch (error) { redirect(`/inventory/issues?error=${encodeURIComponent(errorMessage(error))}`); }
  updateTag(CACHE_TAGS.audit); updateTag(CACHE_TAGS.inventory); updateTag(CACHE_TAGS.issues); updateTag(CACHE_TAGS.reports); redirect("/inventory/issues?success=Handover+cancelled+and+stock+restored+successfully");
}

export async function updateSettingsAction(form: FormData) {
  const admin = await requireAdmin(); const data = settingsInput.parse({ businessName: value(form, "businessName"), phone: value(form, "phone"), email: value(form, "email"), address: value(form, "address"), currencyCode: value(form, "currencyCode"), receiptFooter: value(form, "receiptFooter"), logoUrl: value(form, "logoUrl") });
  const old = await prisma.businessSetting.findUnique({ where: { id: "singleton" } });
  const settings = await prisma.businessSetting.upsert({ where: { id: "singleton" }, update: { ...data, logoUrl: data.logoUrl || null }, create: { id: "singleton", ...data, logoUrl: data.logoUrl || null } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: "SETTINGS_UPDATED", entityType: "BusinessSetting", entityId: settings.id, oldValues: old ? { businessName: old.businessName } : undefined, newValues: { businessName: settings.businessName } } });
  updateTag(CACHE_TAGS.catalog); redirect("/settings?success=Settings+updated");
}

export async function changeOwnPasswordAction(form: FormData) {
  const user = await requireAdmin();
  const parsed = passwordChangeInput.safeParse({ currentPassword: value(form, "currentPassword"), newPassword: value(form, "newPassword"), confirmPassword: value(form, "confirmPassword") });
  if (!parsed.success) redirect("/settings?error=Use+at+least+12+characters+with+uppercase,+lowercase,+number,+and+symbol");
  const account = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { id: true, password: true } });
  if (!account?.password || !(await verifyPassword(account.password, parsed.data.currentPassword))) redirect("/settings?error=Current+password+is+incorrect");
  const password = await hashPassword(parsed.data.newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id: account.id }, data: { password } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.create({ data: { userId: user.id, action: "PASSWORD_CHANGED", entityType: "User", entityId: user.id } });
  });
  const cookieStore = await cookies(); cookieStore.delete(SESSION_COOKIE_NAME);
  updateTag(CACHE_TAGS.audit); redirect("/login?passwordChanged=1");
}
