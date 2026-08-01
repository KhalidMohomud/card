import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReceiptText, Search, X } from "lucide-react";
import { cancelReceiptAction, reprintReceiptAction } from "@/app/actions";
import { Empty } from "@/components/empty";
import { Flash } from "@/components/flash";
import { getCatalogData, getReceiptLedger } from "@/lib/cached-data";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { receiptFilterInput } from "@/lib/validation";

export const metadata = { title: "Receipts" };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role === "SUPERVISOR") redirect("/pos");
  const query = await searchParams;
  const parsedFilters = receiptFilterInput.safeParse(query);
  const filters = parsedFilters.success ? parsedFilters.data : { q: "", page: 1, status: undefined, from: undefined, to: undefined };
  const page = filters.page; const take = 25;
  const [ledger, catalog] = await Promise.all([getReceiptLedger(filters.status, filters.from, filters.to, filters.q, page), getCatalogData()]);
  const receipts = ledger.rows, total = ledger.total, settings = catalog.settings;
  const hasFilters = Boolean(filters.q || filters.from || filters.to || filters.status);
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q); if (filters.from) params.set("from", filters.from); if (filters.to) params.set("to", filters.to); if (filters.status) params.set("status", filters.status);
    params.set("page", String(nextPage)); return `?${params.toString()}`;
  };

  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">Sales ledger</span><h1>Receipt history</h1><p>{total} matching receipt{total === 1 ? "" : "s"}.</p></div></div>
    <Flash success={query.success} error={query.error ?? (!parsedFilters.success ? "Invalid receipt filters were ignored." : undefined)} />
    <Form action="/receipts" className="card filters receipt-filters">
      <div className="field receipt-search-field"><label htmlFor="receipt-search">Search receipts</label><div className="search-input"><Search size={16} /><input id="receipt-search" name="q" defaultValue={filters.q} maxLength={120} placeholder="Receipt #, service, supervisor, payment…" /></div></div>
      <div className="field"><label htmlFor="receipt-from">From</label><input className="input" id="receipt-from" type="date" name="from" defaultValue={filters.from} /></div>
      <div className="field"><label htmlFor="receipt-to">To</label><input className="input" id="receipt-to" type="date" name="to" defaultValue={filters.to} /></div>
      <div className="field"><label htmlFor="receipt-status">Status</label><select className="input" id="receipt-status" name="status" defaultValue={filters.status}><option value="">All statuses</option><option>COMPLETED</option><option>CANCELLED</option></select></div>
      <button className="btn btn-primary"><Search size={15} /> Search</button>
      {hasFilters && <Link className="btn btn-ghost" href="/receipts"><X size={15} /> Clear</Link>}
    </Form>
    <div className="card section-gap">{!receipts.length ? <Empty message="No receipts match your search and filters." /> : <div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date & time</th><th>Service</th><th>Supervisor</th><th>Payment</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td><strong>#{String(receipt.id).padStart(6, "0")}</strong></td><td>{formatDateTime(receipt.issuedAt)}</td><td>{receipt.service}</td><td>{receipt.supervisor}</td><td>{receipt.payment}</td><td className="amount">{formatMoney(receipt.total, settings?.currencyCode)}</td><td><span className={`badge ${receipt.status === "COMPLETED" ? "success" : "danger"}`}>{receipt.status}</span></td><td><div className="actions"><form action={reprintReceiptAction}><input type="hidden" name="id" value={receipt.id} /><button className="btn btn-soft" title="Reprint"><ReceiptText size={14} /> Reprint</button></form>{receipt.status === "COMPLETED" && <form action={cancelReceiptAction} className="inline-form"><input type="hidden" name="id" value={receipt.id} /><input className="input" name="reason" minLength={5} placeholder="Cancellation reason" required /><button className="btn btn-danger">Cancel</button></form>}</div></td></tr>)}</tbody></table></div>}</div>
    {total > take && <div className="actions" style={{ justifyContent: "center", marginTop: 18 }}>{page > 1 && <Link className="btn btn-ghost" href={pageHref(page - 1)}>Previous</Link>}<span className="muted">Page {page} of {Math.ceil(total / take)}</span>{page * take < total && <Link className="btn btn-ghost" href={pageHref(page + 1)}>Next</Link>}</div>}
  </div>;
}
