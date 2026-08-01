"use client";

import { Building2, Pencil, Plus, Save, Search, Trash2, Truck, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createSupplierAction, deleteSupplierAction, updateSupplierAction } from "@/app/actions";

type Supplier = { id: string; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null; isActive: boolean; createdAt: string; _count: { purchases: number } };

export function SupplierCreateDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  function closeAndReset() { dialog.current?.close(); form.current?.reset(); }
  return <>
    <button className="btn btn-primary inventory-create-trigger" type="button" onClick={() => dialog.current?.showModal()}><Plus size={17} /> Add supplier</button>
    <dialog className="account-dialog record-dialog" ref={dialog} aria-labelledby="create-supplier-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}><div className="account-dialog-panel"><div className="account-dialog-head"><span className="account-dialog-icon"><Truck size={22} /></span><div className="account-dialog-title"><h2 id="create-supplier-title">Add supplier</h2><p>Save purchasing contact details for future stock orders.</p></div><button className="icon-button" type="button" aria-label="Close supplier creator" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      <form action={createSupplierAction} className="account-edit-form" ref={form}><SupplierFields idPrefix="new-supplier" /><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button><CreateButton /></div></form>
    </div></dialog>
  </>;
}

export function SupplierCatalog({ suppliers }: { suppliers: Supplier[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase(); return needle ? suppliers.filter((supplier) => [supplier.name, supplier.phone ?? "", supplier.email ?? "", supplier.address ?? "", supplier.notes ?? "", supplier.isActive ? "active" : "archived"].some((value) => value.toLocaleLowerCase().includes(needle))) : suppliers; }, [suppliers, query]);
  return <div className="card service-catalog-card"><div className="card-head service-catalog-head"><div><h2>Suppliers</h2><span className="service-result-count">{query ? `${filtered.length} of ${suppliers.length}` : `${suppliers.length} total`}</span></div><div className="catalog-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, phone, email, address…" aria-label="Search suppliers" />{query && <button type="button" aria-label="Clear supplier search" onClick={() => setQuery("")}><X size={16} /></button>}</div></div>
    {!filtered.length ? <div className="empty service-search-empty"><Search size={27} /><strong>No matching suppliers</strong><span>Try another name, contact detail, address, or status.</span><button className="btn btn-ghost" type="button" onClick={() => setQuery("")}>Clear search</button></div> : <div className="table-wrap record-table-wrap"><table className="record-table inventory-resource-table"><thead><tr><th>Supplier</th><th>Contact</th><th>Purchases</th><th>Status</th><th>Manage</th></tr></thead><tbody>{filtered.map((supplier) => <tr key={supplier.id}><td data-label="Supplier"><div className="service-name-cell"><strong>{supplier.name}</strong><small>{supplier.address || "No address added"}</small></div></td><td data-label="Contact"><div className="service-name-cell"><span>{supplier.phone || "No phone"}</span><small>{supplier.email || "No email"}</small></div></td><td data-label="Purchases" className="amount">{supplier._count.purchases}</td><td data-label="Status"><span className={`badge ${supplier.isActive ? "success" : "danger"}`}>{supplier.isActive ? "Active" : "Archived"}</span></td><td data-label="Manage"><SupplierManager supplier={supplier} /></td></tr>)}</tbody></table></div>}
  </div>;
}

function SupplierManager({ supplier }: { supplier: Supplier }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <><button className="btn btn-ghost btn-compact" type="button" onClick={() => dialog.current?.showModal()}><Pencil size={14} /> Manage</button><dialog className="account-dialog record-dialog" ref={dialog} aria-labelledby={`manage-supplier-${supplier.id}`} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}><div className="account-dialog-panel"><div className="account-dialog-head"><span className="account-dialog-icon"><Building2 size={22} /></span><div className="account-dialog-title"><h2 id={`manage-supplier-${supplier.id}`}>Manage supplier</h2><p>Keep contact information current without changing old purchases.</p></div><button className="icon-button" type="button" aria-label="Close supplier editor" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
    <form action={updateSupplierAction} className="account-edit-form"><input type="hidden" name="id" value={supplier.id} /><SupplierFields idPrefix={supplier.id} supplier={supplier} /><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button><SaveButton /></div></form>
    <div className="danger-zone"><div><strong>Delete supplier</strong><p>{supplier._count.purchases ? "This supplier has purchase history. Archive it so historical purchasing records remain accurate." : "This unused supplier can be permanently deleted."}</p></div><form action={deleteSupplierAction}><input type="hidden" name="id" value={supplier.id} /><DeleteButton disabled={supplier._count.purchases > 0} name={supplier.name} /></form></div>
  </div></dialog></>;
}

function SupplierFields({ idPrefix, supplier }: { idPrefix: string; supplier?: Supplier }) { return <div className="account-form-grid">
  <div className="field account-field-full"><label htmlFor={`${idPrefix}-supplier-name`}>Supplier name</label><input className="input" id={`${idPrefix}-supplier-name`} name="name" defaultValue={supplier?.name} maxLength={120} required /></div>
  <div className="field"><label htmlFor={`${idPrefix}-supplier-phone`}>Phone <span className="muted">— optional</span></label><input className="input" id={`${idPrefix}-supplier-phone`} name="phone" type="tel" defaultValue={supplier?.phone ?? ""} maxLength={500} /></div>
  <div className="field"><label htmlFor={`${idPrefix}-supplier-email`}>Email <span className="muted">— optional</span></label><input className="input" id={`${idPrefix}-supplier-email`} name="email" type="email" defaultValue={supplier?.email ?? ""} /></div>
  <div className="field account-field-full"><label htmlFor={`${idPrefix}-supplier-address`}>Address <span className="muted">— optional</span></label><input className="input" id={`${idPrefix}-supplier-address`} name="address" defaultValue={supplier?.address ?? ""} maxLength={500} /></div>
  {supplier && <div className="field account-field-full"><label htmlFor={`${idPrefix}-supplier-status`}>Status</label><select className="input" id={`${idPrefix}-supplier-status`} name="isActive" defaultValue={String(supplier.isActive)}><option value="true">Active — available for purchases</option><option value="false">Archived — hidden from new purchases</option></select></div>}
  <div className="field account-field-full"><label htmlFor={`${idPrefix}-supplier-notes`}>Notes <span className="muted">— optional</span></label><textarea className="input" id={`${idPrefix}-supplier-notes`} name="notes" defaultValue={supplier?.notes ?? ""} maxLength={500} /></div>
</div>; }
function CreateButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><Plus size={16} />{pending ? "Adding…" : "Add supplier"}</button>; }
function SaveButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><Save size={15} />{pending ? "Saving…" : "Save changes"}</button>; }
function DeleteButton({ disabled, name }: { disabled: boolean; name: string }) { const { pending } = useFormStatus(); return <button className="btn btn-danger" disabled={disabled || pending} title={disabled ? "Archive suppliers that have purchase history" : undefined} onClick={(event) => { if (!window.confirm(`Permanently delete ${name}? This cannot be undone.`)) event.preventDefault(); }}><Trash2 size={15} />{pending ? "Deleting…" : "Delete supplier"}</button>; }
