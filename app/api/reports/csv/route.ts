import { getCurrentUser } from "@/lib/session";
import { parseDateRange } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { stockSnapshot } from "@/modules/inventory/stock";

function csv(rows: (string | number)[][]) { return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"); }
export async function GET(request: Request) {
  const user = await getCurrentUser(); if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url), type = url.searchParams.get("type") ?? "sales", { start, end } = parseDateRange(url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined); let rows: (string | number)[][];
  if (type === "expenses") { const data = await prisma.expense.findMany({ where: { expenseDate: { gte: start, lte: end } }, include: { category: true, supervisor: true } }); rows = [["Date", "Type", "Title", "Category/Supervisor", "Amount", "Payment status", "Record status"], ...data.map((r) => [r.expenseDate.toISOString(), r.type, r.title, r.category?.name ?? r.supervisor?.fullName ?? "", r.amount.toFixed(2), r.paymentStatus, r.status])]; }
  else if (type === "purchases") { const data = await prisma.purchaseItem.findMany({ where: { purchase: { purchaseDate: { gte: start, lte: end } } }, include: { purchase: { include: { supplier: true } }, inventoryItem: true } }); rows = [["Date", "Supplier", "Invoice", "Item", "Quantity", "Unit cost", "Line total", "Status"], ...data.map((r) => [r.purchase.purchaseDate.toISOString(), r.purchase.supplier.name, r.purchase.supplierInvoiceNumber ?? "", r.inventoryItem.name, r.quantity.toString(), r.unitCost.toFixed(2), r.quantity.mul(r.unitCost).toFixed(2), r.purchase.status])]; }
  else if (type === "stock") { const data = await stockSnapshot(); rows = [["SKU", "Item", "Type", "Unit", "Owned", "Assigned", "Available", "Minimum"], ...data.map((r) => [r.sku, r.name, r.type, r.unit, r.owned.toString(), r.assigned.toString(), r.available.toString(), r.minimumStockLevel.toString()])]; }
  else { const data = await prisma.receipt.findMany({ where: { issuedAt: { gte: start, lte: end } }, include: { createdByUser: true, paymentMethod: true } }); rows = [["Receipt", "Date", "Service", "Supervisor", "Payment", "Amount", "Status"], ...data.map((r) => [`#${String(r.id).padStart(6, "0")}`, r.issuedAt.toISOString(), r.serviceNameSnapshot, r.createdByUser.fullName, r.paymentMethod.name, r.servicePriceSnapshot.toFixed(2), r.status])]; }
  return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="swiftwash-${type}.csv"`, "cache-control": "no-store" } });
}
