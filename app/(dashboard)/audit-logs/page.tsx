import { Search, ShieldCheck } from "lucide-react";
import Form from "next/form";
import { Empty } from "@/components/empty";
import { getAuditLedger } from "@/lib/cached-data";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Audit logs" };
export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(); const query = await searchParams; const page = Math.max(Number(query.page) || 1, 1); const ledger = await getAuditLedger(query.action, query.entity, page); const logs = ledger.rows, total = ledger.total;
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Immutable history</span><h1>Audit logs</h1><p>Security and business-critical actions. Logs cannot be edited here.</p></div><span className="badge success"><ShieldCheck size={12} /> {total} events</span></div><Form action="/audit-logs" className="card filters"><div className="field"><label>Action</label><input className="input" name="action" defaultValue={query.action} placeholder="e.g. RECEIPT" /></div><div className="field"><label>Entity</label><input className="input" name="entity" defaultValue={query.entity} placeholder="e.g. Purchase" /></div><button className="btn btn-primary"><Search size={15} /> Search</button></Form><div className="card section-gap">{!logs.length ? <Empty message="No audit events match your search." /> : <div className="table-wrap"><table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Reference</th><th>Details</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{formatDateTime(log.createdAt)}</td><td>{log.user?.fullName ?? "System / unknown"}</td><td><span className="badge">{log.action.replaceAll("_", " ")}</span></td><td>{log.entityType}</td><td>{log.entityId ?? "—"}</td><td className="muted" style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>{log.newValues ? JSON.stringify(log.newValues) : "—"}</td></tr>)}</tbody></table></div>}</div></div>;
}
