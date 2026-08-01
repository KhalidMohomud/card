import { getFreshCurrentUser } from "@/lib/session";
import { getCachedStockSnapshot } from "@/lib/cached-data";
import { parseDateRange } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { createCsv } from "@/lib/csv";
import { reportFilterInput } from "@/lib/validation";
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";

function noStore(response: NextResponse) { response.headers.set("Cache-Control", "no-store"); return response; }

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
  if (type === "expenses") { const data = await prisma.expense.findMany({ where: { expenseDate: { gte: start, lte: end }, ...(supervisorId ? { supervisorUserId: supervisorId } : {}) }, include: { category: true, supervisor: true } }); rows = [["Date", "Type", "Title", "Category/Supervisor", "Amount", "Payment status", "Record status"], ...data.map((r) => [r.expenseDate.toISOString(), r.type, r.title, r.category?.name ?? r.supervisor?.fullName ?? "", r.amount.toFixed(2), r.paymentStatus, r.status])]; }
  else if (type === "purchases") { const data = await prisma.purchaseItem.findMany({ where: { purchase: { status: "RECEIVED", purchaseDate: { gte: start, lte: end } } }, include: { purchase: { include: { supplier: true } }, inventoryItem: true } }); rows = [["Date", "Supplier", "Invoice", "Item", "Quantity", "Unit cost", "Line total", "Status"], ...data.map((r) => [r.purchase.purchaseDate.toISOString(), r.purchase.supplier.name, r.purchase.supplierInvoiceNumber ?? "", r.inventoryItem.name, r.quantity.toString(), r.unitCost.toFixed(2), r.quantity.mul(r.unitCost).toFixed(2), r.purchase.status])]; }
  else if (type === "stock") { const data = await getCachedStockSnapshot(); rows = [["SKU", "Item", "Type", "Unit", "Owned", "Assigned", "Available", "Minimum"], ...data.map((r) => [r.sku, r.name, r.type, r.unit, r.owned, r.assigned, r.available, r.minimumStockLevel])]; }
  else { const data = await prisma.receipt.findMany({ where: { issuedAt: { gte: start, lte: end }, ...(supervisorId ? { createdByUserId: supervisorId } : {}) }, include: { createdByUser: true, paymentMethod: true } }); rows = [["Receipt", "Date", "Service", "Supervisor", "Payment", "Amount", "Status"], ...data.map((r) => [`#${String(r.id).padStart(6, "0")}`, r.issuedAt.toISOString(), r.serviceNameSnapshot, r.createdByUser.fullName, r.paymentMethod.name, r.servicePriceSnapshot.toFixed(2), r.status])]; }
  const supervisorSuffix = selectedSupervisor?.username ? `-${selectedSupervisor.username}` : "";
  return new Response(createCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="swiftwash-${type}${supervisorSuffix}.csv"`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
