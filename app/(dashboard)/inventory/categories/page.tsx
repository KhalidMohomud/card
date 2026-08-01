import { Flash } from "@/components/flash";
import { InventoryCategoryCatalog, InventoryCategoryCreateDialog } from "@/components/inventory-category-catalog";
import { getInventoryCategoriesForManagement } from "@/lib/cached-data";
import { requireManagement } from "@/lib/session";

export const metadata = { title: "Inventory categories" };

export default async function InventoryCategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement();
  const [query, categories] = await Promise.all([searchParams, getInventoryCategoriesForManagement()]);
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Inventory setup</span><h1>Categories</h1><p>Organize supplies and equipment into clear reporting groups.</p></div><InventoryCategoryCreateDialog /></div><Flash success={query.success} error={query.error} /><InventoryCategoryCatalog categories={categories} /></div>;
}
