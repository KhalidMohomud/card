import { Flash } from "@/components/flash";
import { SupplierCatalog, SupplierCreateDialog } from "@/components/supplier-catalog";
import { getSuppliersForManagement } from "@/lib/cached-data";
import { requireManagement } from "@/lib/session";

export const metadata = { title: "Suppliers" };

export default async function InventorySuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement();
  const [query, suppliers] = await Promise.all([searchParams, getSuppliersForManagement()]);
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Inventory setup</span><h1>Suppliers</h1><p>Maintain purchasing contacts while preserving historical orders.</p></div><SupplierCreateDialog /></div><Flash success={query.success} error={query.error} /><SupplierCatalog suppliers={suppliers} /></div>;
}
