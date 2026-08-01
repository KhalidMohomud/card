"use client";

import { ClipboardCheck, Save, SlidersHorizontal, X } from "lucide-react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { adjustStockAction, reconcileStocktakeAction } from "@/app/actions";

type Item = { id: string; name: string; sku: string; unit: string };
type CountableItem = Item & { available: string };

export function InventoryAdjustmentDialog({ items }: { items: Item[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  function closeAndReset() { dialog.current?.close(); form.current?.reset(); }
  return <>
    <button className="btn btn-soft" type="button" disabled={!items.length} onClick={() => dialog.current?.showModal()}><SlidersHorizontal size={16} /> Adjust stock</button>
    <dialog className="account-dialog service-dialog" ref={dialog} aria-labelledby="adjust-stock-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}><div className="account-dialog-panel"><div className="account-dialog-head"><span className="account-dialog-icon"><SlidersHorizontal size={22} /></span><div className="account-dialog-title"><h2 id="adjust-stock-title">Manual stock adjustment</h2><p>Use only for verified corrections. Every adjustment is recorded in the audit trail.</p></div><button className="icon-button" type="button" aria-label="Close stock adjustment" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      <form action={adjustStockAction} className="account-edit-form" ref={form}><div className="account-form-grid"><div className="field account-field-full"><label htmlFor="adjustment-item">Inventory item</label><select className="input" id="adjustment-item" name="inventoryItemId" required>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku} ({item.unit})</option>)}</select></div><div className="field"><label htmlFor="adjustment-direction">Direction</label><select className="input" id="adjustment-direction" name="direction"><option value="IN">Add stock</option><option value="OUT">Remove stock</option></select></div><div className="field"><label htmlFor="adjustment-quantity">Quantity</label><input className="input" id="adjustment-quantity" name="quantity" inputMode="decimal" pattern="\d+(\.\d{1,3})?" placeholder="0.000" required /></div><div className="field account-field-full"><label htmlFor="adjustment-reason">Reason</label><textarea className="input" id="adjustment-reason" name="reason" minLength={5} maxLength={500} placeholder="Explain the verified stock correction" required /></div></div><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button><PostButton /></div></form>
    </div></dialog>
  </>;
}

function PostButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><Save size={15} />{pending ? "Posting…" : "Post adjustment"}</button>; }

export function InventoryStocktakeDialog({ items }: { items: CountableItem[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  function closeAndReset() { dialog.current?.close(); form.current?.reset(); }
  return <><button className="btn btn-soft" type="button" disabled={!items.length} onClick={() => dialog.current?.showModal()}><ClipboardCheck size={16} /> Record stock count</button><dialog className="account-dialog service-dialog" ref={dialog} aria-labelledby="stocktake-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}><div className="account-dialog-panel"><div className="account-dialog-head"><span className="account-dialog-icon"><ClipboardCheck size={22} /></span><div className="account-dialog-title"><h2 id="stocktake-title">Physical stock count</h2><p>Enter the quantity physically available at the store. Any variance creates a permanent stocktake movement.</p></div><button className="icon-button" type="button" aria-label="Close stock count" onClick={closeAndReset}><X size={19} /></button></div><form action={reconcileStocktakeAction} className="account-edit-form" ref={form}><div className="account-form-grid"><div className="field account-field-full"><label htmlFor="stocktake-item">Inventory item</label><select className="input" id="stocktake-item" name="inventoryItemId" required>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · expected {item.available} {item.unit}</option>)}</select></div><div className="field account-field-full"><label htmlFor="stocktake-count">Counted available quantity</label><input className="input" id="stocktake-count" name="countedAvailable" inputMode="decimal" pattern="\d+(\.\d{1,3})?" placeholder="0.000" required /></div><div className="field account-field-full"><label htmlFor="stocktake-reason">Count reason</label><textarea className="input" id="stocktake-reason" name="reason" minLength={5} maxLength={500} placeholder="Example: Month-end physical count witnessed by manager" required /></div></div><div className="record-receive-note"><ClipboardCheck size={18} /><div><strong>Assigned reusable items are protected</strong><span>The count is compared with available store stock. Equipment currently held by supervisors remains assigned.</span></div></div><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button><StocktakeButton /></div></form></div></dialog></>;
}

function StocktakeButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><ClipboardCheck size={15} />{pending ? "Reconciling…" : "Reconcile count"}</button>; }
