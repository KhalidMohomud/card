import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, CircleDollarSign, HandCoins, PackageOpen, ReceiptText, ShoppingCart } from "lucide-react";
import { Empty } from "@/components/empty";
import { getDashboardSnapshot } from "@/lib/cached-data";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Dashboard" };
export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "SUPERVISOR") redirect("/pos");
  const data = await getDashboardSnapshot();
  const lowStock = data.stock.filter((row) => row.low);
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Admin overview</span><h1>Today at a glance</h1><p>Live sales, spending, and stock from your database.</p></div><Link className="btn btn-primary" href="/pos"><ShoppingCart size={17} /> Open POS</Link></div>
    <div className="grid stats-grid"><Stat label="Today's sales" value={formatMoney(data.todaySales.total, data.currency)} note={`${data.todaySales.count} completed receipts`} icon={<CircleDollarSign size={18} />} /><Stat label="Today's expenses" value={formatMoney(data.todayExpenses, data.currency)} note="Active expenses" icon={<HandCoins size={18} />} /><Stat label="Monthly sales" value={formatMoney(data.monthSales.total, data.currency)} note={`${data.monthSales.count} completed receipts`} icon={<ReceiptText size={18} />} /><Stat label="Monthly purchases" value={formatMoney(data.monthPurchases, data.currency)} note="Received inventory" icon={<PackageOpen size={18} />} /></div>
    <div className="grid two-grid section-gap"><div><Recent receipts={data.recent} currency={data.currency} /><div className="card section-gap"><div className="card-head"><h2>Today&apos;s breakdown</h2><Link className="btn btn-ghost" href="/reports">All reports</Link></div><div className="grid three-grid" style={{ padding: "0 20px 20px" }}><Breakdown title="By payment" rows={data.byPayment.map((row) => [row.name, row.count, formatMoney(row.total, data.currency)])} /><Breakdown title="By service" rows={data.byService.map((row) => [row.name, row.count, formatMoney(row.total, data.currency)])} /><Breakdown title="By supervisor" rows={data.bySupervisor.map((row) => [row.name, row.count, formatMoney(row.total, data.currency)])} /></div></div></div>
      <div className="grid"><div className="card card-pad"><div className="card-head" style={{ padding: 0, marginBottom: 14 }}><h2>Low stock</h2><span className={`badge ${lowStock.length ? "warning" : "success"}`}>{lowStock.length}</span></div>{!lowStock.length ? <p className="muted">All active items are above minimum levels.</p> : lowStock.slice(0, 6).map((item) => <div className="checkout-row" key={item.id}><span>{item.name}<small className="muted" style={{ display: "block" }}>{item.category.name}</small></span><strong>{item.available} {item.unit}</strong></div>)}<Link className="btn btn-soft btn-block" href="/inventory"><Boxes size={16} /> View inventory</Link></div><div className="card"><div className="card-head"><h2>Recent movements</h2></div>{!data.movements.length ? <Empty message="No stock movements yet." /> : <div className="table-wrap"><table><tbody>{data.movements.map((movement) => <tr key={movement.id}><td><strong>{movement.item}</strong><small className="muted" style={{ display: "block" }}>{movement.type.replaceAll("_", " ")}</small></td><td className="amount">{movement.quantity}</td></tr>)}</tbody></table></div>}</div></div>
    </div><p className="muted" style={{ fontSize: 12, marginTop: 18 }}>Monthly expenses: <strong>{formatMoney(data.monthExpenses, data.currency)}</strong></p>
  </div>;
}

function Stat({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) { return <div className="card stat"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>; }
type RecentReceipt = { id: number; service: string; supervisor: string; issuedAt: string; total: string };
function Recent({ receipts, currency }: { receipts: RecentReceipt[]; currency: string }) { return <div className="card"><div className="card-head"><h2>Recent receipts</h2><Link className="btn btn-ghost" href="/receipts">View all</Link></div>{!receipts.length ? <Empty message="No receipts have been created yet." /> : <div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Service</th><th>Supervisor</th><th>Time</th><th>Total</th></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td>#{String(receipt.id).padStart(6, "0")}</td><td>{receipt.service}</td><td>{receipt.supervisor}</td><td>{formatDateTime(receipt.issuedAt)}</td><td className="amount">{formatMoney(receipt.total, currency)}</td></tr>)}</tbody></table></div>}</div>; }
function Breakdown({ title, rows }: { title: string; rows: [string, number, string][] }) { return <div><h3 style={{ fontSize: 13 }}>{title}</h3>{rows.length ? rows.map(([name, count, amount]) => <div className="checkout-row" key={name}><span>{name}<small className="muted" style={{ display: "block" }}>{count} receipts</small></span><strong>{amount}</strong></div>) : <p className="muted">No sales yet.</p>}</div>; }
