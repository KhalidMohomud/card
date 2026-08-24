import { z } from "zod";

const requiredText = z.string().trim().min(1).max(120);
const optionalText = z.string().trim().max(500).optional().transform((v) => v || undefined);
const optionalShortText = z.string().trim().max(120).optional().transform((v) => v || undefined);
const MAX_MONEY = 9_999_999_999.99;
const MAX_QUANTITY = 999_999_999.999;
const money = z.string()
  .regex(/^\d+(\.\d{1,2})?$/, "Use a valid amount with up to 2 decimals")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero")
  .refine((value) => Number(value) <= MAX_MONEY, "Amount is too large");
const quantity = z.string()
  .regex(/^\d+(\.\d{1,3})?$/, "Use a positive quantity with up to 3 decimals")
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero")
  .refine((value) => Number(value) <= MAX_QUANTITY, "Quantity is too large");
const nonnegativeQuantity = z.string()
  .regex(/^\d+(\.\d{1,3})?$/, "Use a quantity with up to 3 decimals")
  .refine((value) => Number(value) <= MAX_QUANTITY, "Quantity is too large");
const strongPassword = z.string().min(12).max(128).regex(/[a-z]/, "Add a lowercase letter").regex(/[A-Z]/, "Add an uppercase letter").regex(/\d/, "Add a number").regex(/[^a-zA-Z0-9]/, "Add a symbol");
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Use a valid calendar date");
const optionalCalendarDate = z.union([calendarDate, z.literal("")]).optional().transform((value) => value || undefined);
function validateDateOrder(value: { from?: string; to?: string }, context: z.RefinementCtx) {
  if (value.from && value.to && value.from > value.to) context.addIssue({ code: "custom", path: ["to"], message: "End date must not be before start date" });
}
function validateReportDateRange(value: { from?: string; to?: string }, context: z.RefinementCtx) {
  validateDateOrder(value, context);
  if (!value.from || !value.to || value.from > value.to) return;
  const toUtcDay = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  if (toUtcDay(value.to) - toUtcDay(value.from) > 366) {
    context.addIssue({ code: "custom", path: ["to"], message: "Report range cannot exceed 366 days" });
  }
}

const optionalHttpUrl = z.string().trim().max(2_048).refine((value) => {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "Use a valid HTTP or HTTPS URL");

export const cuidInput = z.string().cuid();
export const positiveIntegerInput = z.coerce.number().int().positive().max(2_147_483_647);
export const pageInput = z.coerce.number().int().min(1).max(10_000).catch(1);
export const booleanInput = z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]);
export const loginInput = z.object({
  username: z.string().trim().transform((value) => value.replace(/^@+/, "").toLowerCase()).pipe(z.string().min(3).max(30).regex(/^[a-z0-9_.]+$/)),
  password: z.string().min(1).max(128),
}).strict();
export const receiptFilterInput = z.object({
  q: z.string().trim().max(120).optional().default(""),
  status: z.union([z.enum(["COMPLETED", "CANCELLED"]), z.literal("")]).optional().transform((value) => value || undefined),
  page: pageInput.optional().default(1),
  from: optionalCalendarDate,
  to: optionalCalendarDate,
}).superRefine(validateDateOrder);
export const reportFilterInput = z.object({
  type: z.enum(["sales", "expenses", "purchases", "stock", "issues", "movements"]).optional().default("sales"),
  supervisorId: z.union([z.string().cuid(), z.literal("")]).optional().transform((value) => value || undefined),
  from: optionalCalendarDate,
  to: optionalCalendarDate,
}).superRefine(validateReportDateRange);

export const receiptInput = z.object({
  serviceId: z.string().cuid(),
  paymentMethodId: z.string().cuid(),
  paymentReference: optionalShortText,
  idempotencyKey: z.string().uuid(),
});

export const serviceInput = z.object({ name: requiredText, price: money, description: optionalText });
export const serviceUpdateInput = serviceInput.extend({ id: z.string().cuid(), isActive: z.enum(["true", "false"]).transform((value) => value === "true") });
export const paymentMethodInput = z.object({ name: requiredText });
export const supervisorInput = z.object({
  fullName: requiredText,
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/),
  password: strongPassword,
  role: z.enum(["SUPERVISOR", "MANAGER"]),
});
export const supervisorUpdateInput = z.object({
  id: z.string().cuid(),
  fullName: requiredText,
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/),
  password: z.union([z.literal(""), strongPassword]).transform((password) => password || undefined),
  role: z.enum(["SUPERVISOR", "MANAGER"]),
});
export const passwordChangeInput = z.object({ currentPassword: z.string().min(1).max(128), newPassword: strongPassword, confirmPassword: z.string() }).refine((data) => data.newPassword === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" }).refine((data) => data.currentPassword !== data.newPassword, { path: ["newPassword"], message: "Choose a different password" });
export const cancellationInput = z.object({ id: z.coerce.number().int().positive(), reason: z.string().trim().min(5).max(500) });
export const expenseInput = z.object({
  type: z.enum(["GENERAL", "WORKER_COMMISSION", "SUPERVISOR_SALARY"]),
  title: requiredText,
  expenseDate: z.coerce.date(),
  categoryId: z.string().optional().transform((v) => v || undefined),
  supervisorUserId: z.string().optional().transform((v) => v || undefined),
  paymentMethodId: z.string().optional().transform((v) => v || undefined),
  paymentStatus: z.enum(["UNPAID", "PAID"]),
  amount: money.optional(),
  carCount: z.coerce.number().int().positive().max(1_000_000).optional(),
  ratePerCar: money.optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  paymentReference: optionalText,
  notes: optionalText,
  overrideReason: optionalText,
});
export const inventoryItemInput = z.object({
  categoryId: z.string().cuid(), sku: requiredText, name: requiredText,
  type: z.enum(["CONSUMABLE", "REUSABLE"]), unit: requiredText,
  minimumStockLevel: nonnegativeQuantity, description: optionalText,
});
export const inventoryItemUpdateInput = inventoryItemInput.extend({
  id: z.string().cuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});
export const inventoryCategoryInput = z.object({ name: requiredText });
export const inventoryCategoryUpdateInput = inventoryCategoryInput.extend({
  id: z.string().cuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});
export const supplierInput = z.object({ name: requiredText, phone: optionalText, email: z.string().email().optional().or(z.literal("")), address: optionalText, notes: optionalText });
export const supplierUpdateInput = supplierInput.extend({
  id: z.string().cuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});
const purchaseLineInput = z.object({ inventoryItemId: z.string().cuid(), quantity, unitCost: money });
export const purchaseInput = z.object({
  supplierId: z.string().cuid(), paymentMethodId: z.string().optional().transform((v) => v || undefined),
  supplierInvoiceNumber: optionalShortText, purchaseDate: z.coerce.date(), paymentStatus: z.enum(["UNPAID", "PAID"]),
  items: z.array(purchaseLineInput).min(1).max(50), notes: optionalText,
}).superRefine((data, context) => uniqueItemLines(data.items, context));

const condition = z.enum(["GOOD", "NEEDS_REPAIR", "DAMAGED", "LOST"]);
const issueLineInput = z.object({ inventoryItemId: z.string().cuid(), quantity, conditionOut: condition.default("GOOD"), notes: optionalText });
export const issueInput = z.object({
  supervisorUserId: z.string().cuid(), issueDate: z.coerce.date(), items: z.array(issueLineInput).min(1).max(50), notes: optionalText,
}).superRefine((data, context) => uniqueItemLines(data.items, context));
export const inventoryIssueUpdateInput = z.object({
  id: z.string().cuid(), supervisorUserId: z.string().cuid(), issueDate: z.coerce.date(), items: z.array(issueLineInput).min(1).max(50), notes: optionalText,
}).superRefine((data, context) => uniqueItemLines(data.items, context));
const reconciliationLineInput = z.object({
  issueItemId: z.string().cuid(), returned: nonnegativeQuantity.default("0"), damaged: nonnegativeQuantity.default("0"), lost: nonnegativeQuantity.default("0"), conditionIn: condition.optional(), notes: optionalText,
});
export const issueCloseInput = z.object({ issueId: z.string().cuid(), items: z.array(reconciliationLineInput).min(1).max(50) });
export const inventoryIssueCancelInput = z.object({ id: z.string().cuid(), reason: z.string().trim().min(5).max(500) });
export const inventoryIssueFilterInput = z.object({
  q: z.string().trim().max(120).optional().default(""),
  status: z.union([z.enum(["ISSUED", "CLOSED", "CANCELLED"]), z.literal("")]).optional().transform((value) => value || undefined),
  supervisorId: z.union([z.string().cuid(), z.literal("")]).optional().transform((value) => value || undefined),
  from: optionalCalendarDate, to: optionalCalendarDate,
  page: pageInput.optional().default(1),
}).superRefine(validateDateOrder);
export const purchaseFilterInput = z.object({ q: z.string().trim().max(120).optional().default(""), page: pageInput.optional().default(1) });
export const auditLogFilterInput = z.object({
  action: z.string().trim().max(120).optional().default(""),
  entity: z.string().trim().max(120).optional().default(""),
  page: pageInput.optional().default(1),
});
export const adjustmentInput = z.object({ inventoryItemId: z.string().cuid(), direction: z.enum(["IN", "OUT"]), quantity, reason: z.string().trim().min(5).max(500) });
export const stocktakeInput = z.object({ inventoryItemId: z.string().cuid(), countedAvailable: nonnegativeQuantity, reason: z.string().trim().min(5).max(500) });

function uniqueItemLines(lines: { inventoryItemId: string }[], context: z.RefinementCtx) {
  const ids = new Set<string>();
  lines.forEach((line, index) => {
    if (ids.has(line.inventoryItemId)) context.addIssue({ code: "custom", path: ["items", index, "inventoryItemId"], message: "Each inventory item can appear only once" });
    ids.add(line.inventoryItemId);
  });
}
export const settingsInput = z.object({
  businessName: requiredText, phone: z.string().trim().max(40), email: z.string().email().or(z.literal("")),
  address: z.string().trim().max(240), currencyCode: z.string().trim().length(3).toUpperCase(), receiptFooter: requiredText,
  logoUrl: optionalHttpUrl.optional().default(""),
});
