import { ReceiptText, Search } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { Flash } from "@/components/flash";
import { Empty } from "@/components/empty";
import { cancelReceiptAction, reprintReceiptAction } from "@/app/actions";
import { getCatalogData, getReceiptLedger } from "@/lib/cached-data";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Receipts" };
export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role === "SUPERVISOR") redirect("/pos");
  const query = await searchParams; const page = Math.max(Number(query.page) || 1, 1); const take = 25;
  const [ledger, catalog] = await Promise.all([getReceiptLedger(query.status, query.from, query.to, page), getCatalogData()]);
  const receipts = ledger.rows, total = ledger.total;
  const settings = catalog.settings;
  const pageHref = (nextPage: number) => { const params = new URLSearchParams(); if (query.from) params.set("from", query.from); if (query.to) params.set("to", query.to); if (query.status) params.set("status", query.status); params.set("page", String(nextPage)); return `?${params.toString()}`; };
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Sales ledger</span><h1>Receipt history</h1><p>{total} receipt{total === 1 ? "" : "s"} in this view.</p></div></div><Flash success={query.success} error={query.error} />
    <Form action="/receipts" className="card filters"><div className="field"><label>From</label><input className="input" type="date" name="from" defaultValue={query.from} /></div><div className="field"><label>To</label><input className="input" type="date" name="to" defaultValue={query.to} /></div><div className="field"><label>Status</label><select className="input" name="status" defaultValue={query.status}><option value="">All statuses</option><option>COMPLETED</option><option>CANCELLED</option></select></div><button className="btn btn-primary"><Search size={15} /> Filter</button></Form>
    <div className="card section-gap">{!receipts.length ? <Empty message="No receipts match this view." /> : <div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date & time</th><th>Service</th><th>Supervisor</th><th>Payment</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td><strong>#{String(receipt.id).padStart(6, "0")}</strong></td><td>{formatDateTime(receipt.issuedAt)}</td><td>{receipt.service}</td><td>{receipt.supervisor}</td><td>{receipt.payment}</td><td className="amount">{formatMoney(receipt.total, settings?.currencyCode)}</td><td><span className={`badge ${receipt.status === "COMPLETED" ? "success" : "danger"}`}>{receipt.status}</span></td><td><div className="actions"><form action={reprintReceiptAction}><input type="hidden" name="id" value={receipt.id} /><button className="btn btn-soft" title="Reprint"><ReceiptText size={14} /> Reprint</button></form>{receipt.status === "COMPLETED" && <form action={cancelReceiptAction} className="inline-form"><input type="hidden" name="id" value={receipt.id} /><input className="input" name="reason" minLength={5} placeholder="Cancellation reason" required /><button className="btn btn-danger">Cancel</button></form>}</div></td></tr>)}</tbody></table></div>}</div>
    {total > take && <div className="actions" style={{ justifyContent: "center", marginTop: 18 }}><Link className="btn btn-ghost" href={pageHref(Math.max(1, page - 1))}>Previous</Link><span className="muted">Page {page} of {Math.ceil(total / take)}</span><Link className="btn btn-ghost" href={pageHref(page + 1)}>Next</Link></div>}
  </div>;
}
