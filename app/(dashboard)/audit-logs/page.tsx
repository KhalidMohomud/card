import Link from "next/link";
import { Activity, ChevronLeft, ChevronRight, ShieldCheck, UserRound } from "lucide-react";
import { Empty } from "@/components/empty";
import { getAuditLedger } from "@/lib/cached-data";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";
import { auditLogFilterInput } from "@/lib/validation";
import { AuditLogFilters } from "./audit-log-filters";
import styles from "./audit-logs.module.css";

export const metadata = { title: "Audit logs" };

function readableLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actionTone(action: string) {
  if (/(FAILED|ERROR|REJECTED|BLOCKED|DELETED|CANCELLED)/.test(action)) return styles.actionDanger;
  if (/(LOGOUT|EXPIRED)/.test(action)) return styles.actionNeutral;
  if (/(LOGIN|SUCCESS|CREATED|RECEIVED|UPDATED|CHANGED|COMPLETED)/.test(action)) return styles.actionPrimary;
  return styles.actionSoft;
}

function displayValue(key: string, value: unknown) {
  if (/(password|token|secret|credential|key)/i.test(key)) return "Hidden";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function detailEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).slice(0, 3);
}

function pageHref(action: string, entity: string, page: number) {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (entity) params.set("entity", entity);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/audit-logs?${query}` : "/audit-logs";
}

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const filters = auditLogFilterInput.parse(query);
  const ledger = await getAuditLedger(filters.action, filters.entity, filters.page);
  const totalPages = Math.max(1, Math.ceil(ledger.total / 50));

  return <div className={`page ${styles.auditPage}`}>
    <header className={styles.hero}>
      <div className={styles.heroIcon}><ShieldCheck size={22} /></div>
      <div>
        <span className={styles.eyebrow}>Security and operations</span>
        <h1>Audit logs</h1>
        <p>Review authentication activity and important changes across EcofriendLC.</p>
      </div>
    </header>

    <section className={styles.ledgerCard} aria-labelledby="activity-history-title">
      <div className={styles.cardToolbar}>
        <div className={styles.activityTitle}>
          <span className={styles.activityIcon}><Activity size={20} /></span>
          <div>
            <h2 id="activity-history-title">Activity history</h2>
            <p>{ledger.total.toLocaleString()} recorded {ledger.total === 1 ? "event" : "events"}</p>
          </div>
        </div>
        <AuditLogFilters actions={ledger.actions} entities={ledger.entities} selectedAction={filters.action} selectedEntity={filters.entity} />
      </div>

      {!ledger.rows.length ? <div className={styles.emptyState}><Empty message="No audit events match these filters." /></div> :
        <div className={styles.tableWrap}>
          <table className={styles.auditTable}>
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Reference</th><th>Details</th></tr></thead>
            <tbody>{ledger.rows.map((log) => {
              const details = detailEntries(log.newValues);
              const userLabel = log.user?.username ? `@${log.user.username}` : log.user?.email ?? "Automated event";
              return <tr key={log.id}>
                <td className={styles.whenCell} data-label="When"><time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time></td>
                <td data-label="User"><div className={styles.userCell}><span className={styles.userAvatar}><UserRound size={16} /></span><div><strong>{log.user?.fullName ?? "System"}</strong><small>{userLabel}</small></div></div></td>
                <td data-label="Action"><span className={`${styles.actionBadge} ${actionTone(log.action)}`}>{readableLabel(log.action)}</span></td>
                <td data-label="Entity"><span className={styles.entityName}>{readableLabel(log.entityType)}</span></td>
                <td className={styles.referenceCell} data-label="Reference">{log.entityId ? <code title={log.entityId}>{log.entityId}</code> : <span>—</span>}</td>
                <td className={styles.detailsCell} data-label="Details">{details.length ? <div className={styles.detailList}>{details.map(([key, value]) => <span key={key}><strong>{readableLabel(key)}:</strong> {displayValue(key, value)}</span>)}</div> : <span>—</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>}

      {ledger.total > 50 && <footer className={styles.pagination}>
        <span>Page {filters.page} of {totalPages}</span>
        <div>
          {filters.page > 1 ? <Link className={styles.pageButton} href={pageHref(filters.action, filters.entity, filters.page - 1)} aria-label="Previous audit page"><ChevronLeft size={16} /> Previous</Link> : <span className={`${styles.pageButton} ${styles.disabled}`}><ChevronLeft size={16} /> Previous</span>}
          {filters.page < totalPages ? <Link className={styles.pageButton} href={pageHref(filters.action, filters.entity, filters.page + 1)} aria-label="Next audit page">Next <ChevronRight size={16} /></Link> : <span className={`${styles.pageButton} ${styles.disabled}`}>Next <ChevronRight size={16} /></span>}
        </div>
      </footer>}
    </section>
  </div>;
}
