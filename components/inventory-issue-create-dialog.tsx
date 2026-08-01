"use client";

import { PackageCheck, Plus, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { issueInventoryAction } from "@/app/actions";

type Supervisor = { id: string; fullName: string };
type Item = { id: string; name: string; sku: string; type: "CONSUMABLE" | "REUSABLE"; unit: string; available: string };
type Line = { key: string; inventoryItemId: string; quantity: string; conditionOut: "GOOD" | "NEEDS_REPAIR"; notes: string };
const newLine = (key: string, itemId = ""): Line => ({ key, inventoryItemId: itemId, quantity: "", conditionOut: "GOOD", notes: "" });

export function InventoryIssueCreateDialog({ supervisors, items, today }: { supervisors: Supervisor[]; items: Item[]; today: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const sequence = useRef(2);
  const [lines, setLines] = useState<Line[]>(() => [newLine("handover-line-1", items[0]?.id)]);
  const unavailable = !supervisors.length || !items.length;
  const selected = useMemo(() => new Set(lines.map((line) => line.inventoryItemId)), [lines]);
  function closeAndReset() { dialog.current?.close(); form.current?.reset(); sequence.current = 2; setLines([newLine("handover-line-1", items[0]?.id)]); }
  function updateLine(key: string, patch: Partial<Line>) { setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line)); }
  function removeLine(key: string) { setLines((current) => current.length === 1 ? current : current.filter((line) => line.key !== key)); }

  return <>
    <button className="btn btn-primary inventory-issue-trigger" type="button" disabled={unavailable} title={unavailable ? "An active supervisor and inventory item are required" : undefined} onClick={() => dialog.current?.showModal()}><PackageCheck size={17} /> New daily handover</button>
    <dialog className="account-dialog record-dialog inventory-handover-dialog" ref={dialog} aria-labelledby="issue-inventory-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel"><div className="account-dialog-head"><span className="account-dialog-icon"><PackageCheck size={22} /></span><div className="account-dialog-title"><h2 id="issue-inventory-title">Daily inventory handover</h2><p>Record every consumable and reusable item given to one supervisor.</p></div><button className="icon-button" type="button" aria-label="Close inventory handover form" onClick={closeAndReset}><X size={19} /></button></div>
        <form action={issueInventoryAction} className="account-edit-form" ref={form}>
          <div className="account-form-grid"><div className="field"><label htmlFor="new-issue-supervisor">Supervisor</label><select className="input" id="new-issue-supervisor" name="supervisorUserId" required>{supervisors.map((row) => <option key={row.id} value={row.id}>{row.fullName}</option>)}</select></div><div className="field"><label htmlFor="new-issue-date">Handover date</label><input className="input" id="new-issue-date" type="date" name="issueDate" defaultValue={today} required /></div></div>
          <input type="hidden" name="itemsJson" value={JSON.stringify(lines.map((line) => ({ inventoryItemId: line.inventoryItemId, quantity: line.quantity, conditionOut: line.conditionOut, notes: line.notes })))} />
          <div className="line-editor"><div className="line-editor-head"><div><strong>Handover items</strong><span>{lines.length} {lines.length === 1 ? "item" : "items"}</span></div><button className="btn btn-soft btn-compact" type="button" disabled={lines.length >= items.length} onClick={() => setLines((current) => [...current, newLine(`handover-line-${sequence.current++}`, items.find((item) => !selected.has(item.id))?.id)])}><Plus size={14} /> Add item</button></div>
            {lines.map((line, index) => { const item = items.find((row) => row.id === line.inventoryItemId); return <div className="line-editor-row" key={line.key}><span className="line-number">{index + 1}</span><div className="field line-item-field"><label htmlFor={`${line.key}-item`}>Inventory item</label><select className="input" id={`${line.key}-item`} value={line.inventoryItemId} onChange={(event) => updateLine(line.key, { inventoryItemId: event.target.value })} required>{items.map((row) => <option key={row.id} value={row.id} disabled={row.id !== line.inventoryItemId && selected.has(row.id)}>{row.name} · {row.sku} · {row.available} {row.unit} available</option>)}</select></div><div className="field"><label htmlFor={`${line.key}-qty`}>Quantity {item ? `(${item.unit})` : ""}</label><input className="input" id={`${line.key}-qty`} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} inputMode="decimal" pattern="\d+(\.\d{1,3})?" placeholder="0.000" required /></div>{item?.type === "REUSABLE" && <div className="field"><label htmlFor={`${line.key}-condition`}>Condition out</label><select className="input" id={`${line.key}-condition`} value={line.conditionOut} onChange={(event) => updateLine(line.key, { conditionOut: event.target.value as Line["conditionOut"] })}><option value="GOOD">Good</option><option value="NEEDS_REPAIR">Needs repair</option></select></div>}<div className="field line-notes-field"><label htmlFor={`${line.key}-notes`}>Line note <span className="muted">— optional</span></label><input className="input" id={`${line.key}-notes`} value={line.notes} onChange={(event) => updateLine(line.key, { notes: event.target.value })} maxLength={500} placeholder="Purpose or condition details" /></div><button className="icon-button line-remove" type="button" aria-label={`Remove item ${index + 1}`} disabled={lines.length === 1} onClick={() => removeLine(line.key)}><Trash2 size={16} /></button></div>; })}
          </div>
          <div className="field"><label htmlFor="new-issue-notes">Handover notes <span className="muted">— optional</span></label><textarea className="input" id="new-issue-notes" name="notes" maxLength={500} placeholder="Shift, vehicle, job, or custody details" /></div>
          <div className="record-receive-note"><PackageCheck size={18} /><div><strong>One auditable handover</strong><span>Consumables reduce stock immediately. Reusable items remain owned and become assigned to the supervisor.</span></div></div><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button><IssueButton /></div>
        </form>
      </div>
    </dialog>
  </>;
}

function IssueButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><PackageCheck size={16} />{pending ? "Posting handover…" : "Post handover"}</button>; }
