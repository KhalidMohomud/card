import Link from "next/link";
import { Tags } from "lucide-react";
import { Flash } from "@/components/flash";
import { InventoryItemCatalog, InventoryItemCreateDialog } from "@/components/inventory-item-catalog";
import { getInventoryCategoriesForManagement, getInventoryItemsForManagement } from "@/lib/cached-data";
import { requireManagement } from "@/lib/session";

export const metadata = { title: "Inventory items" };

export default async function InventoryItemsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement();
  const [query, items, categories] = await Promise.all([searchParams, getInventoryItemsForManagement(), getInventoryCategoriesForManagement()]);
  const categoryOptions = categories.map(({ id, name, isActive }) => ({ id, name, isActive }));
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Inventory setup</span><h1>Inventory items</h1><p>Maintain item codes, tracking types, units, and low-stock levels.</p></div><div className="actions">{!categories.some((category) => category.isActive) && <Link className="btn btn-soft" href="/inventory/categories"><Tags size={16} /> Create category first</Link>}<InventoryItemCreateDialog categories={categoryOptions} /></div></div><Flash success={query.success} error={query.error} /><InventoryItemCatalog items={items} categories={categoryOptions} /></div>;
}
