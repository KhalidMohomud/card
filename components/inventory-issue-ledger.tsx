"use client";

import { CheckCircle2, ClipboardCheck, Eye, Pencil, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { closeIssueAction } from "@/app/actions";

type Issue = {
  id: string; issueDate: string; status: "DRAFT" | "ISSUED" | "CLOSED" | "CANCELLED"; notes: string | null; closedAt: string | null;
  supervisor: { fullName: string };
  items: { id: string; quantityIssued: string; quantityReturned: string; quantityDamaged: string; quantityLost: string; notes: string | null; inventoryItem: { name: string; sku: string; type: "CONSUMABLE" | "REUSABLE"; unit: string } }[];
};

type IssueRow = Issue["items"][number] & Omit<Issue, "items" | "notes"> & { issueNotes: string | null };

export function InventoryIssueLedger({ issues }: { issues: Issue[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => issues.flatMap(({ items, notes: issueNotes, ...issue }) => items.map((item) => ({ ...issue, issueNotes, ...item }))), [issues]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => [row.supervisor.fullName, row.inventoryItem.name, row.inventoryItem.sku, row.inventoryItem.type, row.inventoryItem.unit, statusLabel(row.status), row.issueNotes ?? "", row.notes ?? "", row.issueDate].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [query, rows]);

  return <div className="card service-catalog-card"><div className="card-head service-catalog-head"><div><h2>Issue history</h2><span className="service-result-count">{query ? `${filtered.length} of ${rows.length}` : `${rows.length} records`}</span></div><div className="catalog-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Supervisor, item, SKU, status…" aria-label="Search inventory issues" />{query && <button type="button" aria-label="Clear issue search" onClick={() => setQuery("")}><X size={16} /></button>}</div></div>
    {!filtered.length ? <div className="empty service-search-empty"><Search size={27} /><strong>{rows.length ? "No matching issues" : "No inventory issued yet"}</strong><span>{rows.length ? "Try another supervisor, item, SKU, or status." : "Use Issue inventory to record the first stock handover."}</span>{query && <button className="btn btn-ghost" type="button" onClick={() => setQuery("")}>Clear search</button>}</div> : <div className="table-wrap record-table-wrap"><table className="record-table inventory-issue-table"><thead><tr><th>Date</th><th>Supervisor</th><th>Item</th><th>Issued</th><th>Outcome</th><th>Status</th><th>Manage</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}>
      <td data-label="Date">{formatDate(row.issueDate)}</td><td data-label="Supervisor"><strong>{row.supervisor.fullName}</strong></td><td data-label="Item"><div className="service-name-cell"><strong>{row.inventoryItem.name}</strong><small>{row.inventoryItem.sku} · {row.inventoryItem.type === "CONSUMABLE" ? "Consumable" : "Reusable"}</small></div></td><td data-label="Issued" className="amount">{row.quantityIssued} {row.inventoryItem.unit}</td><td data-label="Outcome">{outcomeLabel(row)}</td><td data-label="Status"><span className={`badge ${row.status === "ISSUED" ? "warning" : row.status === "CLOSED" ? "success" : "danger"}`}>{statusLabel(row.status)}</span></td><td data-label="Manage"><IssueManager row={row} /></td>
    </tr>)}</tbody></table></div>}
  </div>;
}

function IssueManager({ row }: { row: IssueRow }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isOpen = row.status === "ISSUED";
  return <><button className="btn btn-ghost btn-compact" type="button" onClick={() => dialog.current?.showModal()}>{isOpen ? <Pencil size={14} /> : <Eye size={14} />}{isOpen ? "Close issue" : "View"}</button>
    <dialog className="account-dialog record-dialog" ref={dialog} aria-labelledby={`manage-issue-${row.id}`} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}><div className="account-dialog-panel"><div className="account-dialog-head"><span className="account-dialog-icon">{isOpen ? <ClipboardCheck size={22} /> : <CheckCircle2 size={22} />}</span><div className="account-dialog-title"><h2 id={`manage-issue-${row.id}`}>{isOpen ? "Close inventory issue" : "Inventory issue details"}</h2><p>{row.inventoryItem.name} issued to {row.supervisor.fullName} on {formatDate(row.issueDate)}.</p></div><button className="icon-button" type="button" aria-label="Close issue details" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      <div className="issue-summary"><div><span>Issued</span><strong>{row.quantityIssued} {row.inventoryItem.unit}</strong></div><div><span>Tracking</span><strong>{row.inventoryItem.type === "CONSUMABLE" ? "Consumable" : "Reusable"}</strong></div><div><span>Status</span><strong>{statusLabel(row.status)}</strong></div></div>
      {isOpen ? <CloseIssueForm row={row} close={() => dialog.current?.close()} /> : <ClosedIssueDetails row={row} />}
    </div></dialog>
  </>;
}

function CloseIssueForm({ row, close }: { row: IssueRow; close: () => void }) {
  const reusable = row.inventoryItem.type === "REUSABLE";
  return <form action={closeIssueAction} className="account-edit-form"><input type="hidden" name="issueItemId" value={row.id} /><div className="account-form-grid">
    <div className="field"><label htmlFor={`${row.id}-returned`}>Returned</label><input className="input" id={`${row.id}-returned`} name="returned" inputMode="decimal" defaultValue="0" pattern="\d+(\.\d{1,3})?" required /></div>
    {reusable ? <><div className="field"><label htmlFor={`${row.id}-damaged`}>Damaged</label><input className="input" id={`${row.id}-damaged`} name="damaged" inputMode="decimal" defaultValue="0" pattern="\d+(\.\d{1,3})?" required /></div><div className="field"><label htmlFor={`${row.id}-lost`}>Lost</label><input className="input" id={`${row.id}-lost`} name="lost" inputMode="decimal" defaultValue="0" pattern="\d+(\.\d{1,3})?" required /></div></> : <><input type="hidden" name="damaged" value="0" /><input type="hidden" name="lost" value="0" /></>}
    <div className={`field ${reusable ? "" : "account-field-full"}`}><label htmlFor={`${row.id}-close-notes`}>Closing notes <span className="muted">— optional</span></label><textarea className="input" id={`${row.id}-close-notes`} name="notes" maxLength={500} placeholder="Condition, return details, or explanation" /></div>
  </div><div className="record-receive-note"><ClipboardCheck size={18} /><div><strong>{reusable ? "Account for the full issued quantity" : "Returned stock is added back automatically"}</strong><span>{reusable ? `Returned + damaged + lost must equal ${row.quantityIssued} ${row.inventoryItem.unit}.` : "Any quantity not returned remains recorded as consumed."}</span></div></div><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={close}>Cancel</button><CloseButton /></div></form>;
}

function ClosedIssueDetails({ row }: { row: IssueRow }) { return <div className="issue-closed-details"><div className="issue-outcome-grid"><div><span>Returned</span><strong>{row.quantityReturned}</strong></div><div><span>Damaged</span><strong>{row.quantityDamaged}</strong></div><div><span>Lost</span><strong>{row.quantityLost}</strong></div><div><span>{row.inventoryItem.type === "CONSUMABLE" ? "Consumed" : "Unaccounted"}</span><strong>{remainingQuantity(row)}</strong></div></div>{(row.issueNotes || row.notes || row.closedAt) && <div className="issue-notes"><strong>Issue information</strong>{row.closedAt && <span>Closed {formatDate(row.closedAt)}</span>}{row.issueNotes && <p>{row.issueNotes}</p>}{row.notes && <p>{row.notes}</p>}</div>}</div>; }
function CloseButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><CheckCircle2 size={15} />{pending ? "Closing…" : "Confirm and close"}</button>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusLabel(status: IssueRow["status"]) { return status === "ISSUED" ? "Open" : status.charAt(0) + status.slice(1).toLocaleLowerCase(); }
function remainingQuantity(row: Pick<IssueRow, "quantityIssued" | "quantityReturned" | "quantityDamaged" | "quantityLost">) { return Math.max(0, Number(row.quantityIssued) - Number(row.quantityReturned) - Number(row.quantityDamaged) - Number(row.quantityLost)).toLocaleString("en-US", { maximumFractionDigits: 3 }); }
function outcomeLabel(row: IssueRow) { if (row.status === "ISSUED") return <span className="muted">Awaiting return</span>; const parts = [[row.quantityReturned, "returned"], [row.quantityDamaged, "damaged"], [row.quantityLost, "lost"]].filter(([value]) => Number(value) > 0).map(([value, label]) => `${value} ${label}`); const remaining = remainingQuantity(row); if (Number(remaining) > 0 && row.inventoryItem.type === "CONSUMABLE") parts.push(`${remaining} consumed`); return <span>{parts.join(" · ") || "No movement"}</span>; }
