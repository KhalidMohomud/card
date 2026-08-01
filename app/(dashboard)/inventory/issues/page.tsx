import { Flash } from "@/components/flash";
import { InventoryIssueCreateDialog } from "@/components/inventory-issue-create-dialog";
import { InventoryIssueLedger } from "@/components/inventory-issue-ledger";
import { getIssueLedger, getReferenceData } from "@/lib/cached-data";
import { requireManagement } from "@/lib/session";

export const metadata = { title: "Inventory issues and returns" };

export default async function InventoryIssuesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement();
  const [query, issues, references] = await Promise.all([searchParams, getIssueLedger(), getReferenceData()]);
  const supervisors = references.supervisors.filter((row) => row.isActive).map(({ id, fullName }) => ({ id, fullName }));
  const items = references.inventoryItems.map(({ id, name, sku, type, unit }) => ({ id, name, sku, type, unit }));
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Custody & usage</span><h1>Issues and returns</h1><p>Track consumables used and reusable equipment held by supervisors.</p></div><InventoryIssueCreateDialog supervisors={supervisors} items={items} today={new Date().toISOString().slice(0, 10)} /></div><Flash success={query.success} error={query.error} /><InventoryIssueLedger issues={issues} /></div>;
}
