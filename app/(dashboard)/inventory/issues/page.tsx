import { ArrowLeft, PackageCheck, Plus } from "lucide-react";
import Link from "next/link";
import { closeIssueAction, issueInventoryAction } from "@/app/actions";
import { Empty } from "@/components/empty";
import { Flash } from "@/components/flash";
import { getIssueLedger, getReferenceData } from "@/lib/cached-data";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Inventory issues" };
export default async function InventoryIssuesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(); const query = await searchParams; const [issues, references] = await Promise.all([
    getIssueLedger(),
    getReferenceData(),
  ]);
  const items = references.inventoryItems, supervisors = references.supervisors.filter((row) => row.isActive);
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Custody & usage</span><h1>Issues and returns</h1><p>Track consumables used and reusable equipment held by supervisors.</p></div><Link className="btn btn-ghost" href="/inventory"><ArrowLeft size={16} /> Inventory</Link></div><Flash success={query.success} error={query.error} /><div className="grid two-grid"><div className="card"><div className="card-head"><h2>Issue history</h2></div>{!issues.length ? <Empty message="No inventory has been issued." /> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Supervisor</th><th>Item</th><th>Issued</th><th>Status / close</th></tr></thead><tbody>{issues.flatMap((issue) => issue.items.map((row) => <tr key={row.id}><td>{formatDateTime(issue.issueDate)}</td><td>{issue.supervisor.fullName}</td><td><strong>{row.inventoryItem.name}</strong><small className="muted" style={{ display: "block" }}>{row.inventoryItem.type}</small></td><td className="amount">{row.quantityIssued.toString()}</td><td>{issue.status === "ISSUED" ? <form action={closeIssueAction} className="inline-form"><input type="hidden" name="issueItemId" value={row.id} /><input className="input" name="returned" placeholder="Returned" /><input className="input" name="damaged" placeholder="Damaged" /><input className="input" name="lost" placeholder="Lost" /><button className="btn btn-soft">Close</button></form> : <span className="badge success">{issue.status}</span>}</td></tr>))}</tbody></table></div>}</div>
      <form action={issueInventoryAction} className="card card-pad"><span className="stat-icon"><PackageCheck size={18} /></span><h2 style={{ marginTop: 15 }}>Issue inventory</h2><p className="muted">Available stock is rechecked inside the posting transaction.</p><div className="field"><label>Supervisor</label><select className="input" name="supervisorUserId" required>{supervisors.map((row) => <option key={row.id} value={row.id}>{row.fullName}</option>)}</select></div><div className="field" style={{ marginTop: 12 }}><label>Item</label><select className="input" name="inventoryItemId" required>{items.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.type})</option>)}</select></div><div className="form-grid" style={{ marginTop: 12 }}><div className="field"><label>Date</label><input className="input" type="date" name="issueDate" defaultValue={new Date().toISOString().slice(0, 10)} required /></div><div className="field"><label>Quantity</label><input className="input" name="quantity" required /></div></div><div className="field" style={{ marginTop: 12 }}><label>Notes</label><textarea className="input" name="notes" /></div><button className="btn btn-primary btn-block" style={{ marginTop: 15 }}><Plus size={16} /> Issue stock</button></form></div></div>;
}
