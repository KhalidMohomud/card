import { getFreshCurrentUser } from "@/lib/session";
import { getCachedStockSnapshot } from "@/lib/cached-data";
import { parseDateRange } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createCsv } from "@/lib/csv";
import { reportFilterInput } from "@/lib/validation";
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";

const MAX_EXPORT_ROWS = 50_000;
function noStore(response: NextResponse) { response.headers.set("Cache-Control", "no-store"); return response; }
function exportLimitExceeded() { return noStore(NextResponse.json({ message: "This report is too large. Choose a narrower date range." }, { status: 422 })); }

export async function GET(request: Request) {
  const user = await getFreshCurrentUser();
  if (!user) {
    const response = NextResponse.json({ message: "Authentication required." }, { status: 401 });
    clearSessionCookie(response);
    return noStore(response);
  }
  if (!can(user.role, "report:view")) return noStore(NextResponse.json({ message: "Forbidden." }, { status: 403 }));

  const url = new URL(request.url);
  const filters = reportFilterInput.safeParse(Object.fromEntries(url.searchParams));
  if (!filters.success) return noStore(NextResponse.json({ message: "Invalid report filters." }, { status: 400 }));
  const { type, from, to, supervisorId: requestedSupervisorId } = filters.data;
  const { start, end } = parseDateRange(from, to);
  let rows: (string | number)[][];
  const selectedSupervisor = requestedSupervisorId ? await prisma.user.findFirst({ where: { id: requestedSupervisorId, role: "SUPERVISOR" }, select: { id: true, username: true } }) : null;
  if (requestedSupervisorId && !selectedSupervisor) return noStore(NextResponse.json({ message: "Invalid supervisor." }, { status: 400 }));
  const supervisorId = selectedSupervisor?.id;
  if (supervisorId && (type === "purchases" || type === "stock")) return noStore(NextResponse.json({ message: "This export is store-wide and cannot be filtered by supervisor." }, { status: 400 }));
  if (type === "expenses") { const data = await prisma.expense.findMany({ where: { expenseDate: { gte: start, lte: end }, ...(supervisorId ? { supervisorUserId: supervisorId } : {}) }, include: { category: true, supervisor: true }, take: MAX_EXPORT_ROWS + 1 }); if (data.length > MAX_EXPORT_ROWS) return exportLimitExceeded(); rows = [["Date", "Type", "Title", "Category/Supervisor", "Amount", "Payment status", "Record status"], ...data.map((r) => [r.expenseDate.toISOString(), r.type, r.title, r.category?.name ?? r.supervisor?.fullName ?? "", r.amount.toFixed(2), r.paymentStatus, r.status])]; }
  else if (type === "purchases") { const data = await prisma.purchaseItem.findMany({ where: { purchase: { status: "RECEIVED", purchaseDate: { gte: start, lte: end } } }, include: { purchase: { include: { supplier: true } }, inventoryItem: true }, take: MAX_EXPORT_ROWS + 1 }); if (data.length > MAX_EXPORT_ROWS) return exportLimitExceeded(); rows = [["Date", "Supplier", "Invoice", "Item", "Quantity", "Unit cost", "Line total", "Status"], ...data.map((r) => [r.purchase.purchaseDate.toISOString(), r.purchase.supplier.name, r.purchase.supplierInvoiceNumber ?? "", r.inventoryItem.name, r.quantity.toString(), r.unitCost.toFixed(2), r.quantity.mul(r.unitCost).toFixed(2), r.purchase.status])]; }
  else if (type === "stock") { const data = await getCachedStockSnapshot(); if (data.length > MAX_EXPORT_ROWS) return exportLimitExceeded(); rows = [["SKU", "Item", "Type", "Unit", "Owned", "Assigned", "Available", "Minimum"], ...data.map((r) => [r.sku, r.name, r.type, r.unit, r.owned, r.assigned, r.available, r.minimumStockLevel])]; }
  else if (type === "issues") { const data = await prisma.inventoryIssueItem.findMany({ where: { inventoryIssue: { issueDate: { gte: start, lte: end }, ...(supervisorId ? { supervisorUserId: supervisorId } : {}) } }, include: { inventoryIssue: { include: { supervisor: true } }, inventoryItem: true }, orderBy: { inventoryIssue: { issueDate: "desc" } }, take: MAX_EXPORT_ROWS + 1 }); if (data.length > MAX_EXPORT_ROWS) return exportLimitExceeded(); rows = [["Date", "Supervisor", "Item", "Type", "Unit", "Issued", "Returned", "Used", "Damaged", "Lost", "Status"], ...data.map((r) => [r.inventoryIssue.issueDate.toISOString(), r.inventoryIssue.supervisor.fullName, r.inventoryItem.name, r.inventoryItem.type, r.inventoryItem.unit, r.quantityIssued.toString(), r.quantityReturned.toString(), r.inventoryItem.type === "CONSUMABLE" ? r.quantityIssued.sub(r.quantityReturned).toString() : "0", r.quantityDamaged.toString(), r.quantityLost.toString(), r.inventoryIssue.status])]; }
  else if (type === "movements") { const data = await prisma.inventoryMovement.findMany({ where: { createdAt: { gte: start, lte: end }, ...(supervisorId ? { inventoryIssueItem: { inventoryIssue: { supervisorUserId: supervisorId } } } : {}) }, include: { inventoryItem: true, createdByUser: true }, orderBy: { createdAt: "desc" }, take: MAX_EXPORT_ROWS + 1 }); if (data.length > MAX_EXPORT_ROWS) return exportLimitExceeded(); rows = [["Date", "Item", "Type", "Quantity", "Reason", "Recorded by"], ...data.map((r) => [r.createdAt.toISOString(), r.inventoryItem.name, r.movementType, r.quantity.toString(), r.notes ?? "", r.createdByUser.fullName])]; }
  else { const data = await prisma.receipt.findMany({ where: { issuedAt: { gte: start, lte: end }, ...(supervisorId ? { createdByUserId: supervisorId } : {}) }, include: { createdByUser: true, paymentMethod: true }, take: MAX_EXPORT_ROWS + 1 }); if (data.length > MAX_EXPORT_ROWS) return exportLimitExceeded(); rows = [["Receipt", "Date", "Service", "Supervisor", "Payment", "Amount", "Status"], ...data.map((r) => [`#${String(r.id).padStart(6, "0")}`, r.issuedAt.toISOString(), r.serviceNameSnapshot, r.createdByUser.fullName, r.paymentMethod.name, r.servicePriceSnapshot.toFixed(2), r.status])]; }
  const supervisorSuffix = selectedSupervisor?.username ? `-${selectedSupervisor.username}` : "";
  return new Response(createCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="swiftwash-${type}${supervisorSuffix}.csv"`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
