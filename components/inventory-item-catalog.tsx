"use client";

import { Boxes, Pencil, Plus, Save, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createInventoryItemAction, deleteInventoryItemAction, updateInventoryItemAction } from "@/app/actions";
import { ConfirmActionButton } from "@/components/confirm-action-button";

type Category = { id: string; name: string; isActive: boolean };
type InventoryItem = {
  id: string; categoryId: string; sku: string; name: string; type: "CONSUMABLE" | "REUSABLE"; unit: string;
  minimumStockLevel: string; description: string | null; isActive: boolean; createdAt: string;
  category: Category; _count: { purchaseItems: number; issueItems: number; movements: number };
};

const commonUnits = ["Bottle", "Box", "Gallon", "Kilogram", "Litre", "Pack", "Piece"];

export function InventoryItemCreateDialog({ categories }: { categories: Category[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const availableCategories = categories.filter((category) => category.isActive);
  function closeAndReset() { dialog.current?.close(); form.current?.reset(); }

  return <>
    <button className="btn btn-primary inventory-create-trigger" type="button" disabled={!availableCategories.length} title={!availableCategories.length ? "Create an active category first" : undefined} onClick={() => dialog.current?.showModal()}><Plus size={17} /> Add inventory item</button>
    <dialog className="account-dialog record-dialog" ref={dialog} aria-labelledby="create-inventory-item-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head"><span className="account-dialog-icon"><Boxes size={22} /></span><div className="account-dialog-title"><h2 id="create-inventory-item-title">Add inventory item</h2><p>Create a reusable asset or consumable supply for stock tracking.</p></div><button className="icon-button" type="button" aria-label="Close item creator" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <form action={createInventoryItemAction} className="account-edit-form" ref={form}>
          <ItemFields idPrefix="new-inventory-item" categories={availableCategories} />
          <div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button><SubmitButton label="Add item" pendingLabel="Adding…" icon="plus" /></div>
        </form>
      </div>
    </dialog>
  </>;
}

export function InventoryItemCatalog({ items, categories }: { items: InventoryItem[]; categories: Category[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.name, item.sku, item.category.name, item.type, item.unit, item.description ?? "", item.isActive ? "active" : "archived"].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [items, query]);

  return <div className="card service-catalog-card">
    <div className="card-head service-catalog-head"><div><h2>Inventory items</h2><span className="service-result-count">{query ? `${filtered.length} of ${items.length}` : `${items.length} total`}</span></div><CatalogSearch value={query} onChange={setQuery} placeholder="Name, SKU, category, type…" label="Search inventory items" /></div>
    {!filtered.length ? <SearchEmpty label="inventory items" clear={() => setQuery("")} /> : <div className="table-wrap record-table-wrap"><table className="record-table inventory-resource-table"><thead><tr><th>Item</th><th>Category</th><th>Type / unit</th><th>Minimum</th><th>Status</th><th>Manage</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}>
      <td data-label="Item"><div className="service-name-cell"><strong>{item.name}</strong><small>{item.sku}{item.description ? ` · ${item.description}` : ""}</small></div></td>
      <td data-label="Category">{item.category.name}</td>
      <td data-label="Type / unit"><span className="badge">{item.type === "CONSUMABLE" ? "Consumable" : "Reusable"}</span><small className="inventory-unit">{item.unit}</small></td>
      <td data-label="Minimum" className="amount">{item.minimumStockLevel}</td>
      <td data-label="Status"><span className={`badge ${item.isActive ? "success" : "danger"}`}>{item.isActive ? "Active" : "Archived"}</span></td>
      <td data-label="Manage"><InventoryItemManager item={item} categories={categories} /></td>
    </tr>)}</tbody></table></div>}
  </div>;
}

function InventoryItemManager({ item, categories }: { item: InventoryItem; categories: Category[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const historyCount = item._count.purchaseItems + item._count.issueItems + item._count.movements;
  return <>
    <button className="btn btn-ghost btn-compact" type="button" onClick={() => dialog.current?.showModal()}><Pencil size={14} /> Manage</button>
    <dialog className="account-dialog record-dialog" ref={dialog} aria-labelledby={`manage-item-${item.id}`} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head"><span className="account-dialog-icon"><Boxes size={22} /></span><div className="account-dialog-title"><h2 id={`manage-item-${item.id}`}>Manage inventory item</h2><p>Update catalogue details without changing recorded stock movements.</p></div><button className="icon-button" type="button" aria-label="Close item editor" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <form action={updateInventoryItemAction} className="account-edit-form"><input type="hidden" name="id" value={item.id} /><ItemFields idPrefix={item.id} categories={includeCategory(categories, item.category)} item={item} trackingLocked={historyCount > 0} /><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button><SubmitButton label="Save changes" pendingLabel="Saving…" icon="save" /></div></form>
        <div className="danger-zone"><div><strong>Delete inventory item</strong><p>{historyCount ? "This item has business history. Set its status to Archived to keep records accurate." : "This unused item can be permanently deleted."}</p></div><form action={deleteInventoryItemAction}><input type="hidden" name="id" value={item.id} /><ConfirmActionButton triggerLabel="Delete item" title={`Delete ${item.name}?`} description="This inventory item will be permanently removed from the catalogue." confirmLabel="Delete item" pendingLabel="Deleting…" disabled={historyCount > 0} disabledReason="Archive this item because it has business history" /></form></div>
      </div>
    </dialog>
  </>;
}

function ItemFields({ idPrefix, categories, item, trackingLocked = false }: { idPrefix: string; categories: Category[]; item?: InventoryItem; trackingLocked?: boolean }) {
  return <div className="account-form-grid">
    <div className="field"><label htmlFor={`${idPrefix}-name`}>Item name</label><input className="input" id={`${idPrefix}-name`} name="name" defaultValue={item?.name} maxLength={120} required /></div>
    <div className="field"><label htmlFor={`${idPrefix}-sku`}>SKU / item code</label><input className="input" id={`${idPrefix}-sku`} name="sku" defaultValue={item?.sku} maxLength={120} autoCapitalize="characters" required /></div>
    <div className="field"><label htmlFor={`${idPrefix}-category`}>Category</label><select className="input" id={`${idPrefix}-category`} name="categoryId" defaultValue={item?.categoryId} required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? "" : " — archived"}</option>)}</select></div>
    <div className="field"><label htmlFor={`${idPrefix}-type`}>Tracking type</label><select className="input" id={`${idPrefix}-type`} name={trackingLocked ? undefined : "type"} disabled={trackingLocked} defaultValue={item?.type ?? "CONSUMABLE"}><option value="CONSUMABLE">Consumable — used up</option><option value="REUSABLE">Reusable — issued and returned</option></select>{trackingLocked && <input type="hidden" name="type" value={item?.type} />}</div>
    <div className="field"><label htmlFor={`${idPrefix}-unit`}>Unit</label><input className="input" id={`${idPrefix}-unit`} name={trackingLocked ? undefined : "unit"} disabled={trackingLocked} list={`${idPrefix}-common-units`} defaultValue={item?.unit ?? "Piece"} maxLength={120} required />{trackingLocked && <input type="hidden" name="unit" value={item?.unit} />}<datalist id={`${idPrefix}-common-units`}>{commonUnits.map((unit) => <option key={unit} value={unit} />)}</datalist></div>
    <div className="field"><label htmlFor={`${idPrefix}-minimum`}>Low-stock alert level</label><input className="input" id={`${idPrefix}-minimum`} name="minimumStockLevel" inputMode="decimal" defaultValue={item?.minimumStockLevel ?? "0"} pattern="\d+(\.\d{1,3})?" required /></div>
    {item && <div className="field account-field-full"><label htmlFor={`${idPrefix}-status`}>Catalogue status</label><select className="input" id={`${idPrefix}-status`} name="isActive" defaultValue={String(item.isActive)}><option value="true">Active — available for operations</option><option value="false">Archived — hidden from new transactions</option></select></div>}
    {trackingLocked && <div className="account-security-note account-field-full"><Boxes size={18} /><div><strong>Tracking is protected</strong><span>Type and unit are locked because this item has stock history.</span></div></div>}
    <div className="field account-field-full"><label htmlFor={`${idPrefix}-description`}>Description <span className="muted">— optional</span></label><textarea className="input" id={`${idPrefix}-description`} name="description" maxLength={500} defaultValue={item?.description ?? ""} /></div>
  </div>;
}

function CatalogSearch({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) { return <div className="catalog-search"><Search size={17} aria-hidden="true" /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} />{value && <button type="button" aria-label="Clear search" onClick={() => onChange("")}><X size={16} /></button>}</div>; }
function SearchEmpty({ label, clear }: { label: string; clear: () => void }) { return <div className="empty service-search-empty"><Search size={27} /><strong>No matching {label}</strong><span>Try another name, code, status, or description.</span><button className="btn btn-ghost" type="button" onClick={clear}>Clear search</button></div>; }
function includeCategory(categories: Category[], current: Category) { return categories.some((category) => category.id === current.id) ? categories : [current, ...categories]; }
function SubmitButton({ label, pendingLabel, icon }: { label: string; pendingLabel: string; icon: "plus" | "save" }) { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}>{icon === "plus" ? <Plus size={16} /> : <Save size={15} />}{pending ? pendingLabel : label}</button>; }
