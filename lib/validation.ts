import { z } from "zod";

const requiredText = z.string().trim().min(1).max(120);
const optionalText = z.string().trim().max(500).optional().transform((v) => v || undefined);
const money = z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a valid amount with up to 2 decimals");
const quantity = z.string().regex(/^\d+(\.\d{1,3})?$/, "Use a positive quantity with up to 3 decimals").refine((value) => Number(value) > 0, "Quantity must be greater than zero");
const nonnegativeQuantity = z.string().regex(/^\d+(\.\d{1,3})?$/, "Use a quantity with up to 3 decimals");
const strongPassword = z.string().min(12).max(128).regex(/[a-z]/, "Add a lowercase letter").regex(/[A-Z]/, "Add an uppercase letter").regex(/\d/, "Add a number").regex(/[^a-zA-Z0-9]/, "Add a symbol");

export const receiptInput = z.object({
  serviceId: z.string().cuid(),
  paymentMethodId: z.string().cuid(),
  paymentReference: optionalText,
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
  carCount: z.coerce.number().int().positive().optional(),
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
  minimumStockLevel: quantity, description: optionalText,
});
export const supplierInput = z.object({ name: requiredText, phone: optionalText, email: z.string().email().optional().or(z.literal("")), address: optionalText });
export const purchaseInput = z.object({
  supplierId: z.string().cuid(), paymentMethodId: z.string().optional().transform((v) => v || undefined),
  supplierInvoiceNumber: optionalText, purchaseDate: z.coerce.date(), paymentStatus: z.enum(["UNPAID", "PAID"]),
  inventoryItemId: z.string().cuid(), quantity, unitCost: money, notes: optionalText,
});
export const issueInput = z.object({
  supervisorUserId: z.string().cuid(), issueDate: z.coerce.date(), inventoryItemId: z.string().cuid(), quantity, notes: optionalText,
});
export const issueCloseInput = z.object({
  issueItemId: z.string().cuid(), returned: nonnegativeQuantity.default("0"), damaged: nonnegativeQuantity.default("0"), lost: nonnegativeQuantity.default("0"), notes: optionalText,
});
export const adjustmentInput = z.object({ inventoryItemId: z.string().cuid(), direction: z.enum(["IN", "OUT"]), quantity, reason: z.string().trim().min(5).max(500) });
export const settingsInput = z.object({
  businessName: requiredText, phone: z.string().trim().max(40), email: z.string().email().or(z.literal("")),
  address: z.string().trim().max(240), currencyCode: z.string().trim().length(3).toUpperCase(), receiptFooter: requiredText,
  logoUrl: z.string().url().optional().or(z.literal("")),
});
