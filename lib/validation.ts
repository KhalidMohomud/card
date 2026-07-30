import { z } from "zod";

const requiredText = z.string().trim().min(1).max(120);
const optionalText = z.string().trim().max(500).optional().transform((v) => v || undefined);
const money = z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a valid amount with up to 2 decimals");
const quantity = z.string().regex(/^\d+(\.\d{1,3})?$/, "Use a positive quantity with up to 3 decimals").refine((value) => Number(value) > 0, "Quantity must be greater than zero");
const nonnegativeQuantity = z.string().regex(/^\d+(\.\d{1,3})?$/, "Use a quantity with up to 3 decimals");

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
  password: z.string().min(10).max(128),
});
export const supervisorUpdateInput = z.object({
  id: z.string().cuid(),
  fullName: requiredText,
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/),
  password: z.string().max(128).refine((password) => password.length === 0 || password.length >= 10, "Password must have at least 10 characters").transform((password) => password || undefined),
});
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
