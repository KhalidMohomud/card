"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { LockKeyhole, PackageCheck, Pencil, Save, X } from "lucide-react";
import { deletePurchaseAction, receivePurchaseAction, updatePurchaseAction } from "@/app/actions";
import { ConfirmActionButton } from "@/components/confirm-action-button";

type Option = { id: string; name: string };
type Purchase = {
  id: string; supplierId: string; paymentMethodId: string | null; supplierInvoiceNumber: string | null;
  purchaseDate: string; paymentStatus: "UNPAID" | "PAID"; notes: string | null; status: "DRAFT" | "RECEIVED" | "CANCELLED";
  supplier: Option; items: { id: string; inventoryItemId: string; inventoryItem: Option; quantity: string; unitCost: string }[];
};

export function PurchaseActions({ purchase, suppliers, methods, items }: { purchase: Purchase; suppliers: Option[]; methods: Option[]; items: Option[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  if (purchase.status !== "DRAFT") return <span className="locked-label" title="Received purchases are locked because inventory was already posted"><LockKeyhole size={14} /> Posted</span>;
  const item = purchase.items[0];
  const supplierOptions = includeCurrent(suppliers, purchase.supplier);
  const itemOptions = includeCurrent(items, item?.inventoryItem ?? null);
  const titleId = `manage-purchase-${purchase.id}`;
  return <div className="actions purchase-actions">
    <form action={receivePurchaseAction}><input type="hidden" name="id" value={purchase.id} /><ConfirmActionButton tone="success" triggerClassName="btn btn-soft btn-compact" triggerIcon={<PackageCheck size={14} />} triggerLabel="Receive" title="Receive this purchase?" description="The delivery will be posted to inventory and this draft will become locked." warning="Confirm the delivered item, quantity, and cost before posting." confirmLabel="Receive purchase" pendingLabel="Receiving…" /></form>
    <button className="btn btn-ghost btn-compact" type="button" onClick={() => dialog.current?.showModal()}><Pencil size={14} /> Manage</button>
    <dialog className="account-dialog record-dialog purchase-dialog" ref={dialog} aria-labelledby={titleId} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head"><span className="account-dialog-icon"><PackageCheck size={22} /></span><div className="account-dialog-title"><h2 id={titleId}>Manage draft purchase</h2><p>Review details before receiving stock.</p></div><button className="icon-button" type="button" aria-label="Close purchase editor" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <form action={updatePurchaseAction} className="account-edit-form">
          <input type="hidden" name="id" value={purchase.id} />
          <div className="account-form-grid">
            <div className="field"><label htmlFor={`${purchase.id}-supplier`}>Supplier</label><select className="input" id={`${purchase.id}-supplier`} name="supplierId" defaultValue={purchase.supplierId} required>{supplierOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
            <div className="field"><label htmlFor={`${purchase.id}-date`}>Purchase date</label><input className="input" id={`${purchase.id}-date`} type="date" name="purchaseDate" defaultValue={purchase.purchaseDate.slice(0, 10)} required /></div>
            <div className="field"><label htmlFor={`${purchase.id}-method`}>Payment method</label><select className="input" id={`${purchase.id}-method`} name="paymentMethodId" defaultValue={purchase.paymentMethodId ?? ""}><option value="">Not specified</option>{methods.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
            <div className="field"><label htmlFor={`${purchase.id}-payment`}>Payment status</label><select className="input" id={`${purchase.id}-payment`} name="paymentStatus" defaultValue={purchase.paymentStatus}><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option></select></div>
            <div className="field account-field-full"><label htmlFor={`${purchase.id}-invoice`}>Supplier invoice <span className="muted">— optional</span></label><input className="input" id={`${purchase.id}-invoice`} name="supplierInvoiceNumber" defaultValue={purchase.supplierInvoiceNumber ?? ""} /></div>
            <div className="field account-field-full"><label htmlFor={`${purchase.id}-item`}>Inventory item</label><select className="input" id={`${purchase.id}-item`} name="inventoryItemId" defaultValue={item?.inventoryItemId ?? ""} required>{itemOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
            <div className="field"><label htmlFor={`${purchase.id}-quantity`}>Quantity</label><input className="input" id={`${purchase.id}-quantity`} name="quantity" inputMode="decimal" defaultValue={item?.quantity ?? ""} required /></div>
            <div className="field"><label htmlFor={`${purchase.id}-cost`}>Unit cost</label><input className="input" id={`${purchase.id}-cost`} name="unitCost" inputMode="decimal" defaultValue={item?.unitCost ?? ""} required /></div>
            <div className="field account-field-full"><label htmlFor={`${purchase.id}-notes`}>Notes <span className="muted">— optional</span></label><textarea className="input" id={`${purchase.id}-notes`} name="notes" defaultValue={purchase.notes ?? ""} /></div>
          </div>
          <div className="record-receive-note"><PackageCheck size={18} /><div><strong>Still a draft</strong><span>Saving does not change inventory. Use Receive when the delivery is verified.</span></div></div>
          <div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button><SaveButton /></div>
        </form>
        <div className="danger-zone"><div><strong>Delete this draft</strong><p>Drafts have not changed inventory and can be safely removed.</p></div><form action={deletePurchaseAction}><input type="hidden" name="id" value={purchase.id} /><ConfirmActionButton triggerLabel="Delete draft" title="Delete draft purchase?" description="This draft purchase will be permanently removed from the purchase ledger." confirmLabel="Delete draft" pendingLabel="Deleting…" /></form></div>
      </div>
    </dialog>
  </div>;
}

function includeCurrent(options: Option[], current: Option | null) { return current && !options.some((row) => row.id === current.id) ? [current, ...options] : options; }
function SaveButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><Save size={15} />{pending ? "Saving…" : "Save draft"}</button>; }
