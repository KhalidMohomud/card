import { ReceiptText, Search } from "lucide-react";
import { Flash } from "@/components/flash";
import { Empty } from "@/components/empty";
import { cancelReceiptAction, reprintReceiptAction } from "@/app/actions";
import { endOfDate, formatDateTime, startOfToday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Receipts" };
export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(); const query = await searchParams; const page = Math.max(Number(query.page) || 1, 1); const take = 25;
  const where = { ...(user.role === "SUPERVISOR" ? { createdByUserId: user.id, issuedAt: { gte: startOfToday() } } : {}), ...(query.status ? { status: query.status as "COMPLETED" | "CANCELLED" } : {}), ...(query.from || query.to ? { issuedAt: { gte: query.from ? new Date(`${query.from}T00:00:00`) : undefined, lte: query.to ? endOfDate(query.to) : undefined } } : {}) };
  const [receipts, total, settings] = await Promise.all([
    prisma.receipt.findMany({ where, include: { paymentMethod: true, createdByUser: true }, orderBy: { id: "desc" }, skip: (page - 1) * take, take }),
    prisma.receipt.count({ where }), prisma.businessSetting.findUnique({ where: { id: "singleton" } }),
  ]);
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Sales ledger</span><h1>{user.role === "SUPERVISOR" ? "Today's receipts" : "Receipt history"}</h1><p>{total} receipt{total === 1 ? "" : "s"} in this view.</p></div></div><Flash success={query.success} error={query.error} />
    {user.role === "ADMIN" && <form className="card filters"><div className="field"><label>From</label><input className="input" type="date" name="from" defaultValue={query.from} /></div><div className="field"><label>To</label><input className="input" type="date" name="to" defaultValue={query.to} /></div><div className="field"><label>Status</label><select className="input" name="status" defaultValue={query.status}><option value="">All statuses</option><option>COMPLETED</option><option>CANCELLED</option></select></div><button className="btn btn-primary"><Search size={15} /> Filter</button></form>}
    <div className="card section-gap">{!receipts.length ? <Empty message="No receipts match this view." /> : <div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date & time</th><th>Service</th><th>Supervisor</th><th>Payment</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td><strong>#{String(receipt.id).padStart(6, "0")}</strong></td><td>{formatDateTime(receipt.issuedAt)}</td><td>{receipt.serviceNameSnapshot}</td><td>{receipt.createdByUser.fullName}</td><td>{receipt.paymentMethod.name}</td><td className="amount">{formatMoney(receipt.servicePriceSnapshot, settings?.currencyCode)}</td><td><span className={`badge ${receipt.status === "COMPLETED" ? "success" : "danger"}`}>{receipt.status}</span></td><td><div className="actions"><form action={reprintReceiptAction}><input type="hidden" name="id" value={receipt.id} /><button className="btn btn-soft" title="Reprint"><ReceiptText size={14} /> Reprint</button></form>{user.role === "ADMIN" && receipt.status === "COMPLETED" && <form action={cancelReceiptAction} className="inline-form"><input type="hidden" name="id" value={receipt.id} /><input className="input" name="reason" minLength={5} placeholder="Cancellation reason" required /><button className="btn btn-danger">Cancel</button></form>}</div></td></tr>)}</tbody></table></div>}</div>
    {total > take && <div className="actions" style={{ justifyContent: "center", marginTop: 18 }}><a className="btn btn-ghost" href={`?page=${Math.max(1, page - 1)}`}>Previous</a><span className="muted">Page {page} of {Math.ceil(total / take)}</span><a className="btn btn-ghost" href={`?page=${page + 1}`}>Next</a></div>}
  </div>;
}
