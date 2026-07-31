import Form from "next/form";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PackagePlus, Plus, Search, X } from "lucide-react";
import { createPurchaseAction } from "@/app/actions";
import { Empty } from "@/components/empty";
import { Flash } from "@/components/flash";
import { PurchaseActions } from "@/components/purchase-manager";
import { getCatalogData, getPurchaseLedger, getReferenceData } from "@/lib/cached-data";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireManagement } from "@/lib/session";

export const metadata = { title: "Purchases" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement();
  const query = await searchParams;
  const [purchases, catalog, references] = await Promise.all([getPurchaseLedger(query.q), getCatalogData(), getReferenceData()]);
  const suppliers = references.suppliers, methods = catalog.methods.filter((row) => row.isActive), items = references.inventoryItems, settings = catalog.settings;

  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">Stock intake</span><h1>Purchases</h1><p>Drafts can be edited or deleted. Receiving posts stock and locks the purchase.</p></div></div>
    <Flash success={query.success} error={query.error} />
    <div className="grid two-grid">
      <div className="card">
        <div className="card-head service-catalog-head"><div><h2>Purchase history</h2>{query.q && <span className="service-result-count">{purchases.length} found</span>}</div><div className="ledger-search-actions"><Form action="/purchases" className="catalog-search"><Search size={17} /><input name="q" defaultValue={query.q} placeholder="Supplier, invoice, item, status…" aria-label="Search purchases" /><button type="submit" aria-label="Search purchases"><Search size={15} /></button></Form>{query.q && <Link className="btn btn-ghost btn-compact" href="/purchases"><X size={14} /> Clear</Link>}</div></div>
        {!purchases.length ? <Empty message={query.q ? "No purchases match your search." : "No purchases registered."} /> : <div className="table-wrap record-table-wrap"><table className="record-table"><thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Items</th><th>Total</th><th>Status</th><th>Manage</th></tr></thead><tbody>{purchases.map((purchase) => { const total = new Prisma.Decimal(purchase.total); return <tr key={purchase.id}><td data-label="Date">{formatDateTime(purchase.purchaseDate)}</td><td data-label="Supplier">{purchase.supplier.name}</td><td data-label="Invoice">{purchase.supplierInvoiceNumber || "—"}</td><td data-label="Items">{purchase.items.map((row) => `${row.inventoryItem.name} × ${row.quantity}`).join(", ")}</td><td data-label="Total" className="amount">{formatMoney(total, settings?.currencyCode)}</td><td data-label="Status"><span className={`badge ${purchase.status === "RECEIVED" ? "success" : purchase.status === "CANCELLED" ? "danger" : "warning"}`}>{purchase.status}</span></td><td data-label="Manage"><PurchaseActions purchase={purchase} suppliers={suppliers} methods={methods} items={items} /></td></tr>; })}</tbody></table></div>}
      </div>
      <form action={createPurchaseAction} className="card card-pad">
        <span className="stat-icon"><PackagePlus size={18} /></span><h2 style={{ marginTop: 15 }}>Register purchase</h2><p className="muted">This creates a draft. Review it in the list, then receive it.</p>
        <div className="form-grid"><div className="field"><label>Supplier</label><select className="input" name="supplierId" required>{suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div><div className="field"><label>Purchase date</label><input className="input" type="date" name="purchaseDate" defaultValue={new Date().toISOString().slice(0, 10)} required /></div><div className="field"><label>Payment method</label><select className="input" name="paymentMethodId"><option value="">Select</option>{methods.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div><div className="field"><label>Payment status</label><select className="input" name="paymentStatus"><option>PAID</option><option>UNPAID</option></select></div><div className="field full"><label>Supplier invoice</label><input className="input" name="supplierInvoiceNumber" /></div><div className="field full"><label>Inventory item</label><select className="input" name="inventoryItemId" required>{items.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div><div className="field"><label>Quantity</label><input className="input" name="quantity" required /></div><div className="field"><label>Unit cost</label><input className="input" name="unitCost" required /></div><div className="field full"><label>Notes</label><textarea className="input" name="notes" /></div></div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 16 }}><Plus size={16} /> Create draft</button>
      </form>
    </div>
  </div>;
}
