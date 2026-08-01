"use client";

import { PackageCheck, Plus, X } from "lucide-react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { issueInventoryAction } from "@/app/actions";

type Supervisor = { id: string; fullName: string };
type Item = { id: string; name: string; sku: string; type: "CONSUMABLE" | "REUSABLE"; unit: string };

export function InventoryIssueCreateDialog({ supervisors, items, today }: { supervisors: Supervisor[]; items: Item[]; today: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const unavailable = !supervisors.length || !items.length;
  function closeAndReset() { dialog.current?.close(); form.current?.reset(); }

  return <>
    <button className="btn btn-primary inventory-issue-trigger" type="button" disabled={unavailable} title={unavailable ? "An active supervisor and inventory item are required" : undefined} onClick={() => dialog.current?.showModal()}><PackageCheck size={17} /> Issue inventory</button>
    <dialog className="account-dialog record-dialog" ref={dialog} aria-labelledby="issue-inventory-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel"><div className="account-dialog-head"><span className="account-dialog-icon"><PackageCheck size={22} /></span><div className="account-dialog-title"><h2 id="issue-inventory-title">Issue inventory</h2><p>Assign reusable equipment or record consumables used by a supervisor.</p></div><button className="icon-button" type="button" aria-label="Close inventory issue form" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <form action={issueInventoryAction} className="account-edit-form" ref={form}><div className="account-form-grid">
          <div className="field"><label htmlFor="new-issue-supervisor">Supervisor</label><select className="input" id="new-issue-supervisor" name="supervisorUserId" required>{supervisors.map((row) => <option key={row.id} value={row.id}>{row.fullName}</option>)}</select></div>
          <div className="field"><label htmlFor="new-issue-date">Issue date</label><input className="input" id="new-issue-date" type="date" name="issueDate" defaultValue={today} required /></div>
          <div className="field account-field-full"><label htmlFor="new-issue-item">Inventory item</label><select className="input" id="new-issue-item" name="inventoryItemId" required>{items.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.sku} ({row.type === "CONSUMABLE" ? "Consumable" : "Reusable"}, {row.unit})</option>)}</select></div>
          <div className="field account-field-full"><label htmlFor="new-issue-quantity">Quantity</label><input className="input" id="new-issue-quantity" name="quantity" inputMode="decimal" pattern="\d+(\.\d{1,3})?" placeholder="0.000" required /></div>
          <div className="field account-field-full"><label htmlFor="new-issue-notes">Issue notes <span className="muted">— optional</span></label><textarea className="input" id="new-issue-notes" name="notes" maxLength={500} placeholder="Purpose, job, or custody details" /></div>
        </div><div className="record-receive-note"><PackageCheck size={18} /><div><strong>Stock is protected</strong><span>Available quantity is checked again when this issue is posted.</span></div></div><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button><IssueButton /></div></form>
      </div>
    </dialog>
  </>;
}

function IssueButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><Plus size={16} />{pending ? "Issuing…" : "Issue stock"}</button>; }
