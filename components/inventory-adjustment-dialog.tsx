"use client";

import { Save, SlidersHorizontal, X } from "lucide-react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { adjustStockAction } from "@/app/actions";

type Item = { id: string; name: string; sku: string; unit: string };

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
