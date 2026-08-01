import Link from "next/link";
import { AlertTriangle, Boxes, PackageCheck, PackagePlus, Tags, Truck, UsersRound } from "lucide-react";
import { Flash } from "@/components/flash";
import { InventoryAdjustmentDialog, InventoryStocktakeDialog } from "@/components/inventory-adjustment-dialog";
import { InventoryStockTable } from "@/components/inventory-stock-table";
import { getCachedStockSnapshot } from "@/lib/cached-data";
import { requireManagement } from "@/lib/session";

export const metadata = { title: "Inventory overview" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement();
  const [query, stock] = await Promise.all([searchParams, getCachedStockSnapshot()]);
  const lowStock = stock.filter((item) => item.low).length;
  const assigned = stock.reduce((total, item) => total + Number(item.assigned), 0);
  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">Stock control</span><h1>Inventory overview</h1><p>Monitor live quantities calculated from permanent stock movements.</p></div><div className="actions"><InventoryStocktakeDialog items={stock.map(({ id, name, sku, unit, available }) => ({ id, name, sku, unit, available }))} /><InventoryAdjustmentDialog items={stock.map(({ id, name, sku, unit }) => ({ id, name, sku, unit }))} /><Link className="btn btn-soft" href="/inventory/issues"><Truck size={16} /> Handovers</Link><Link className="btn btn-primary" href="/purchases"><PackagePlus size={16} /> Register purchase</Link></div></div>
    <Flash success={query.success} error={query.error} />
    <div className="stats-grid grid inventory-summary-grid"><div className="card stat"><div className="stat-top"><span>Active items</span><span className="stat-icon"><Boxes size={18} /></span></div><div className="stat-value">{stock.length}</div><div className="stat-note">Items currently tracked</div></div><div className="card stat"><div className="stat-top"><span>Low stock</span><span className="stat-icon"><AlertTriangle size={18} /></span></div><div className={`stat-value ${lowStock ? "text-danger" : ""}`}>{lowStock}</div><div className="stat-note">At or below minimum level</div></div><div className="card stat"><div className="stat-top"><span>Assigned reusable stock</span><span className="stat-icon"><PackageCheck size={18} /></span></div><div className="stat-value">{assigned.toLocaleString("en-US", { maximumFractionDigits: 3 })}</div><div className="stat-note">Currently held by supervisors</div></div></div>
    <div className="section-gap"><InventoryStockTable stock={stock} /></div>
    <div className="inventory-shortcuts section-gap" aria-label="Inventory setup shortcuts"><Link className="card inventory-shortcut" href="/inventory/items"><span className="stat-icon"><Boxes size={18} /></span><span><strong>Inventory items</strong><small>Manage stock catalogue and alert levels</small></span></Link><Link className="card inventory-shortcut" href="/inventory/categories"><span className="stat-icon"><Tags size={18} /></span><span><strong>Categories</strong><small>Organize related stock items</small></span></Link><Link className="card inventory-shortcut" href="/inventory/suppliers"><span className="stat-icon"><UsersRound size={18} /></span><span><strong>Suppliers</strong><small>Manage purchasing contacts</small></span></Link></div>
  </div>;
}
