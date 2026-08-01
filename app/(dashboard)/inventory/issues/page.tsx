import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Flash } from "@/components/flash";
import { InventoryIssueCreateDialog } from "@/components/inventory-issue-create-dialog";
import { InventoryIssueLedger } from "@/components/inventory-issue-ledger";
import { getCachedStockSnapshot, getIssueLedger, getReferenceData } from "@/lib/cached-data";
import { businessDateInputValue } from "@/lib/dates";
import { requireManagement } from "@/lib/session";
import { inventoryIssueFilterInput } from "@/lib/validation";

export const metadata = { title: "Inventory handovers and reconciliation" };

export default async function InventoryIssuesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement();
  const query = await searchParams;
  const parsed = inventoryIssueFilterInput.safeParse(query);
  const filters = parsed.success ? parsed.data : { q: "", status: undefined, supervisorId: undefined, from: undefined, to: undefined, page: 1 };
  const [ledger, references, stock] = await Promise.all([getIssueLedger(filters.q, filters.status, filters.supervisorId, filters.from, filters.to, filters.page), getReferenceData(), getCachedStockSnapshot()]);
  const supervisors = references.supervisors.filter((row) => row.isActive).map(({ id, fullName }) => ({ id, fullName }));
  const availability = new Map(stock.map((row) => [row.id, row.available]));
  const items = references.inventoryItems.map(({ id, name, sku, type, unit }) => ({ id, name, sku, type, unit, available: availability.get(id) ?? "0" }));
  const pages = Math.max(1, Math.ceil(ledger.total / 25));
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Custody & usage</span><h1>Daily inventory handovers</h1><p>Issue a supervisor’s full shift allocation, then reconcile every return, loss, and consumable used.</p></div><InventoryIssueCreateDialog supervisors={supervisors} items={items} today={businessDateInputValue()} /></div><Flash success={query.success} error={query.error ?? (!parsed.success ? "Invalid inventory filters were ignored." : undefined)} />
    <Form action="/inventory/issues" className="card filters inventory-ledger-filters"><div className="field search-filter"><label htmlFor="issue-search">Search</label><div className="search-input"><Search size={16} /><input id="issue-search" name="q" defaultValue={filters.q} placeholder="Supervisor, item, SKU, notes…" /></div></div><div className="field"><label htmlFor="issue-status">Status</label><select className="input" id="issue-status" name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option><option value="ISSUED">Open</option><option value="CLOSED">Closed</option><option value="CANCELLED">Cancelled</option></select></div><div className="field"><label htmlFor="issue-supervisor">Supervisor</label><select className="input" id="issue-supervisor" name="supervisorId" defaultValue={filters.supervisorId ?? ""}><option value="">All supervisors</option>{references.supervisors.map((row) => <option value={row.id} key={row.id}>{row.fullName}{row.isActive ? "" : " — disabled"}</option>)}</select></div><div className="field"><label htmlFor="issue-from">From</label><input className="input" id="issue-from" type="date" name="from" defaultValue={filters.from} /></div><div className="field"><label htmlFor="issue-to">To</label><input className="input" id="issue-to" type="date" name="to" defaultValue={filters.to} /></div><button className="btn btn-primary"><Search size={15} /> Apply</button></Form>
    <div className="section-gap"><div className="ledger-title-row"><div><h2>Handover history</h2><span>{ledger.total} records</span></div></div><InventoryIssueLedger issues={ledger.rows} supervisors={supervisors} items={items} />{pages > 1 && <Pager page={filters.page} pages={pages} filters={filters} />}</div>
  </div>;
}

function Pager({ page, pages, filters }: { page: number; pages: number; filters: { q?: string; status?: string; supervisorId?: string; from?: string; to?: string } }) {
  const href = (next: number) => { const params = new URLSearchParams(); for (const [key, value] of Object.entries(filters)) if (key !== "page" && value) params.set(key, value); params.set("page", String(next)); return `/inventory/issues?${params}`; };
  return <nav className="pager" aria-label="Inventory handover pages"><Link className={`btn btn-ghost ${page <= 1 ? "disabled" : ""}`} aria-disabled={page <= 1} href={page <= 1 ? href(1) : href(page - 1)}><ChevronLeft size={15} /> Previous</Link><span>Page {page} of {pages}</span><Link className={`btn btn-ghost ${page >= pages ? "disabled" : ""}`} aria-disabled={page >= pages} href={page >= pages ? href(pages) : href(page + 1)}>Next <ChevronRight size={15} /></Link></nav>;
}
