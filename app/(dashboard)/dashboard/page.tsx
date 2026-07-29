import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ArrowRight, Boxes, CarFront, CircleDollarSign, HandCoins, PackageOpen, ReceiptText, ShoppingCart } from "lucide-react";
import { Empty } from "@/components/empty";
import { formatDateTime, startOfMonth, startOfToday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { stockSnapshot } from "@/modules/inventory/stock";

export const metadata = { title: "Dashboard" };
export default async function DashboardPage() {
  const user = await requireUser(); const today = startOfToday(); const month = startOfMonth();
  const receiptWhere = { status: "COMPLETED" as const, issuedAt: { gte: today }, ...(user.role === "SUPERVISOR" ? { createdByUserId: user.id } : {}) };
  const [todaySales, monthSales, recent, settings] = await Promise.all([
    prisma.receipt.aggregate({ where: receiptWhere, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.aggregate({ where: { status: "COMPLETED", issuedAt: { gte: month }, ...(user.role === "SUPERVISOR" ? { createdByUserId: user.id } : {}) }, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.findMany({ where: user.role === "SUPERVISOR" ? { createdByUserId: user.id, issuedAt: { gte: today } } : {}, include: { createdByUser: true, paymentMethod: true }, orderBy: { id: "desc" }, take: 7 }),
    prisma.businessSetting.findUnique({ where: { id: "singleton" } }),
  ]);
  const currency = settings?.currencyCode ?? "USD";
  if (user.role === "SUPERVISOR") return <div className="page"><div className="page-head"><div><span className="eyebrow">Supervisor dashboard</span><h1>Good day, {user.fullName.split(" ")[0]}</h1><p>Your live sales activity for today.</p></div><Link className="btn btn-primary" href="/pos"><ShoppingCart size={17} /> Open POS <ArrowRight size={16} /></Link></div><div className="grid three-grid"><Stat label="Today's receipts" value={String(todaySales._count)} note="Completed car washes" icon={<ReceiptText size={18} />} /><Stat label="Today's sales" value={formatMoney(todaySales._sum.servicePriceSnapshot ?? 0, currency)} note="Completed receipts only" icon={<CircleDollarSign size={18} />} /><Stat label="This month" value={formatMoney(monthSales._sum.servicePriceSnapshot ?? 0, currency)} note={`${monthSales._count} completed receipts`} icon={<CarFront size={18} />} /></div><Recent receipts={recent} currency={currency} /></div>;

  const [todayExpenses, monthExpenses, monthPurchases, allStock, byPayment, byService, bySupervisor, movements] = await Promise.all([
    prisma.expense.aggregate({ where: { status: "ACTIVE", expenseDate: { gte: today } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { status: "ACTIVE", expenseDate: { gte: month } }, _sum: { amount: true } }),
    prisma.purchaseItem.findMany({ where: { purchase: { status: "RECEIVED", purchaseDate: { gte: month } } }, select: { quantity: true, unitCost: true } }),
    stockSnapshot(),
    prisma.receipt.groupBy({ by: ["paymentMethodId"], where: { status: "COMPLETED", issuedAt: { gte: today } }, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.groupBy({ by: ["serviceNameSnapshot"], where: { status: "COMPLETED", issuedAt: { gte: today } }, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.receipt.groupBy({ by: ["createdByUserId"], where: { status: "COMPLETED", issuedAt: { gte: today } }, _count: true, _sum: { servicePriceSnapshot: true } }),
    prisma.inventoryMovement.findMany({ include: { inventoryItem: true, createdByUser: true }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const methodNames = new Map((await prisma.paymentMethod.findMany()).map((m) => [m.id, m.name])); const userNames = new Map((await prisma.user.findMany({ select: { id: true, fullName: true } })).map((u) => [u.id, u.fullName]));
  const purchaseTotal = monthPurchases.reduce((total, row) => total.add(row.quantity.mul(row.unitCost)), new Prisma.Decimal(0)); const lowStock = allStock.filter((row) => row.available.lessThanOrEqualTo(row.minimumStockLevel));
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Admin overview</span><h1>Today at a glance</h1><p>Live sales, spending, and stock from your database.</p></div><Link className="btn btn-primary" href="/pos"><ShoppingCart size={17} /> Open POS</Link></div>
    <div className="grid stats-grid"><Stat label="Today's sales" value={formatMoney(todaySales._sum.servicePriceSnapshot ?? 0, currency)} note={`${todaySales._count} completed receipts`} icon={<CircleDollarSign size={18} />} /><Stat label="Today's expenses" value={formatMoney(todayExpenses._sum.amount ?? 0, currency)} note="Active expenses" icon={<HandCoins size={18} />} /><Stat label="Monthly sales" value={formatMoney(monthSales._sum.servicePriceSnapshot ?? 0, currency)} note={`${monthSales._count} completed receipts`} icon={<ReceiptText size={18} />} /><Stat label="Monthly purchases" value={formatMoney(purchaseTotal, currency)} note="Received inventory" icon={<PackageOpen size={18} />} /></div>
    <div className="grid two-grid section-gap"><div><Recent receipts={recent} currency={currency} /><div className="card section-gap"><div className="card-head"><h2>Today&apos;s breakdown</h2><Link className="btn btn-ghost" href="/reports">All reports</Link></div><div className="grid three-grid" style={{ padding: "0 20px 20px" }}><Breakdown title="By payment" rows={byPayment.map((x) => [methodNames.get(x.paymentMethodId) ?? "Unknown", x._count, formatMoney(x._sum.servicePriceSnapshot ?? 0, currency)])} /><Breakdown title="By service" rows={byService.map((x) => [x.serviceNameSnapshot, x._count, formatMoney(x._sum.servicePriceSnapshot ?? 0, currency)])} /><Breakdown title="By supervisor" rows={bySupervisor.map((x) => [userNames.get(x.createdByUserId) ?? "Unknown", x._count, formatMoney(x._sum.servicePriceSnapshot ?? 0, currency)])} /></div></div></div>
      <div className="grid"><div className="card card-pad"><div className="card-head" style={{ padding: 0, marginBottom: 14 }}><h2>Low stock</h2><span className={`badge ${lowStock.length ? "warning" : "success"}`}>{lowStock.length}</span></div>{!lowStock.length ? <p className="muted">All active items are above minimum levels.</p> : lowStock.slice(0, 6).map((item) => <div className="checkout-row" key={item.id}><span>{item.name}<small className="muted" style={{ display: "block" }}>{item.category.name}</small></span><strong>{item.available.toString()} {item.unit}</strong></div>)}<Link className="btn btn-soft btn-block" href="/inventory"><Boxes size={16} /> View inventory</Link></div><div className="card"><div className="card-head"><h2>Recent movements</h2></div>{!movements.length ? <Empty message="No stock movements yet." /> : <div className="table-wrap"><table><tbody>{movements.map((movement) => <tr key={movement.id}><td><strong>{movement.inventoryItem.name}</strong><small className="muted" style={{ display: "block" }}>{movement.movementType.replaceAll("_", " ")}</small></td><td className="amount">{movement.quantity.toString()}</td></tr>)}</tbody></table></div>}</div></div>
    </div><p className="muted" style={{ fontSize: 12, marginTop: 18 }}>Monthly expenses: <strong>{formatMoney(monthExpenses._sum.amount ?? 0, currency)}</strong></p>
  </div>;
}

function Stat({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) { return <div className="card stat"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>; }
type RecentReceipt = Prisma.ReceiptGetPayload<{ include: { createdByUser: true; paymentMethod: true } }>;
function Recent({ receipts, currency }: { receipts: RecentReceipt[]; currency: string }) { return <div className="card"><div className="card-head"><h2>Recent receipts</h2><Link className="btn btn-ghost" href="/receipts">View all</Link></div>{!receipts.length ? <Empty message="No receipts have been created yet." /> : <div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Service</th><th>Supervisor</th><th>Time</th><th>Total</th></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td>#{String(receipt.id).padStart(6, "0")}</td><td>{receipt.serviceNameSnapshot}</td><td>{receipt.createdByUser.fullName}</td><td>{formatDateTime(receipt.issuedAt)}</td><td className="amount">{formatMoney(receipt.servicePriceSnapshot, currency)}</td></tr>)}</tbody></table></div>}</div>; }
function Breakdown({ title, rows }: { title: string; rows: [string, number, string][] }) { return <div><h3 style={{ fontSize: 13 }}>{title}</h3>{rows.length ? rows.map(([name, count, amount]) => <div className="checkout-row" key={name}><span>{name}<small className="muted" style={{ display: "block" }}>{count} receipts</small></span><strong>{amount}</strong></div>) : <p className="muted">No sales yet.</p>}</div>; }
