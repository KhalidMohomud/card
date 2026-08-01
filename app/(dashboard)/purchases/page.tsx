import Form from "next/form";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Empty } from "@/components/empty";
import { Flash } from "@/components/flash";
import { PurchaseCreateDialog } from "@/components/purchase-create-dialog";
import { PurchaseActions } from "@/components/purchase-manager";
import { getCatalogData, getPurchaseLedger, getReferenceData } from "@/lib/cached-data";
import { businessDateInputValue, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireManagement } from "@/lib/session";
import { purchaseFilterInput } from "@/lib/validation";

export const metadata = { title: "Purchases" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement();
  const query = await searchParams;
  const parsed = purchaseFilterInput.safeParse(query);
  const filters = parsed.success ? parsed.data : { q: "", page: 1 };
  const [ledger, catalog, references] = await Promise.all([getPurchaseLedger(filters.q, filters.page), getCatalogData(), getReferenceData()]);
  const purchases = ledger.rows;
  const suppliers = references.suppliers, methods = catalog.methods.filter((row) => row.isActive), items = references.inventoryItems, settings = catalog.settings;
  const pages = Math.max(1, Math.ceil(ledger.total / 25));

  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">Stock intake</span><h1>Purchases</h1><p>Drafts can be edited or deleted. Receiving posts stock and locks the purchase.</p></div><PurchaseCreateDialog suppliers={suppliers} methods={methods} items={items} today={businessDateInputValue()} /></div>
    <Flash success={query.success} error={query.error ?? (!parsed.success ? "Invalid purchase filters were ignored." : undefined)} />
    <div className="card">
        <div className="card-head service-catalog-head"><div><h2>Purchase history</h2><span className="service-result-count">{ledger.total} records</span></div><div className="ledger-search-actions"><Form action="/purchases" className="catalog-search"><Search size={17} /><input name="q" defaultValue={filters.q} placeholder="Supplier, invoice, item, status…" aria-label="Search purchases" /><button type="submit" aria-label="Search purchases"><Search size={15} /></button></Form>{filters.q && <Link className="btn btn-ghost btn-compact" href="/purchases"><X size={14} /> Clear</Link>}</div></div>
        {!purchases.length ? <Empty message={filters.q ? "No purchases match your search." : "No purchases registered."} /> : <div className="table-wrap record-table-wrap"><table className="record-table"><thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Items</th><th>Total</th><th>Status</th><th>Manage</th></tr></thead><tbody>{purchases.map((purchase) => { const total = new Prisma.Decimal(purchase.total); return <tr key={purchase.id}><td data-label="Date">{formatDateTime(purchase.purchaseDate)}</td><td data-label="Supplier">{purchase.supplier.name}</td><td data-label="Invoice">{purchase.supplierInvoiceNumber || "—"}</td><td data-label="Items">{purchase.items.map((row) => `${row.inventoryItem.name} × ${row.quantity}`).join(", ")}</td><td data-label="Total" className="amount">{formatMoney(total, settings?.currencyCode)}</td><td data-label="Status"><span className={`badge ${purchase.status === "RECEIVED" ? "success" : purchase.status === "CANCELLED" ? "danger" : "warning"}`}>{purchase.status}</span></td><td data-label="Manage"><PurchaseActions purchase={purchase} suppliers={suppliers} methods={methods} items={items} /></td></tr>; })}</tbody></table></div>}
    </div>
    {pages > 1 && <nav className="pager" aria-label="Purchase pages"><Link className={`btn btn-ghost ${filters.page <= 1 ? "disabled" : ""}`} aria-disabled={filters.page <= 1} href={`/purchases?q=${encodeURIComponent(filters.q)}&page=${Math.max(1, filters.page - 1)}`}><ChevronLeft size={15} /> Previous</Link><span>Page {filters.page} of {pages}</span><Link className={`btn btn-ghost ${filters.page >= pages ? "disabled" : ""}`} aria-disabled={filters.page >= pages} href={`/purchases?q=${encodeURIComponent(filters.q)}&page=${Math.min(pages, filters.page + 1)}`}>Next <ChevronRight size={15} /></Link></nav>}
  </div>;
}
