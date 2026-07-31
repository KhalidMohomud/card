"use client";

import { PackagePlus, Plus, X } from "lucide-react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createPurchaseAction } from "@/app/actions";

type Option = { id: string; name: string };

export function PurchaseCreateDialog({ suppliers, methods, items, today }: { suppliers: Option[]; methods: Option[]; items: Option[]; today: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);

  function closeAndReset() {
    dialog.current?.close();
    form.current?.reset();
  }

  return <>
    <button className="btn btn-primary purchase-create-trigger" type="button" onClick={() => dialog.current?.showModal()}>
      <PackagePlus size={17} /> Register purchase
    </button>
    <dialog className="account-dialog record-dialog purchase-dialog" ref={dialog} aria-labelledby="create-purchase-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head">
          <span className="account-dialog-icon"><PackagePlus size={22} /></span>
          <div className="account-dialog-title">
            <h2 id="create-purchase-title">Register purchase</h2>
            <p>Create a draft now. Inventory changes only after the delivery is received.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close purchase creator" onClick={() => dialog.current?.close()}><X size={19} /></button>
        </div>
        <form action={createPurchaseAction} className="account-edit-form" ref={form}>
          <div className="account-form-grid">
            <div className="field"><label htmlFor="new-purchase-supplier">Supplier</label><select className="input" id="new-purchase-supplier" name="supplierId" required>{suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
            <div className="field"><label htmlFor="new-purchase-date">Purchase date</label><input className="input" id="new-purchase-date" type="date" name="purchaseDate" defaultValue={today} required /></div>
            <div className="field account-field-full"><label htmlFor="new-purchase-item">Inventory item</label><select className="input" id="new-purchase-item" name="inventoryItemId" required>{items.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
            <div className="field"><label htmlFor="new-purchase-quantity">Quantity</label><input className="input" id="new-purchase-quantity" name="quantity" inputMode="decimal" placeholder="0.000" required /></div>
            <div className="field"><label htmlFor="new-purchase-cost">Unit cost</label><input className="input" id="new-purchase-cost" name="unitCost" inputMode="decimal" placeholder="0.00" required /></div>
            <div className="field"><label htmlFor="new-purchase-method">Payment method <span className="muted">— optional</span></label><select className="input" id="new-purchase-method" name="paymentMethodId"><option value="">Not specified</option>{methods.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
            <div className="field"><label htmlFor="new-purchase-payment">Payment status</label><select className="input" id="new-purchase-payment" name="paymentStatus" defaultValue="PAID"><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option></select></div>
            <div className="field account-field-full"><label htmlFor="new-purchase-invoice">Supplier invoice <span className="muted">— optional</span></label><input className="input" id="new-purchase-invoice" name="supplierInvoiceNumber" /></div>
            <div className="field account-field-full"><label htmlFor="new-purchase-notes">Notes <span className="muted">— optional</span></label><textarea className="input" id="new-purchase-notes" name="notes" /></div>
          </div>
          <div className="account-dialog-actions">
            <button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button>
            <CreateDraftButton />
          </div>
        </form>
      </div>
    </dialog>
  </>;
}

function CreateDraftButton() {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" disabled={pending}><Plus size={16} /> {pending ? "Creating…" : "Create draft"}</button>;
}
