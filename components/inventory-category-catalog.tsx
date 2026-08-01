"use client";

import { FolderPlus, Pencil, Plus, Save, Search, Tags, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createInventoryCategoryAction, deleteInventoryCategoryAction, updateInventoryCategoryAction } from "@/app/actions";
import { ConfirmActionButton } from "@/components/confirm-action-button";

type Category = { id: string; name: string; isActive: boolean; createdAt: string; _count: { items: number } };

export function InventoryCategoryCreateDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  function closeAndReset() { dialog.current?.close(); form.current?.reset(); }
  return <>
    <button className="btn btn-primary inventory-create-trigger" type="button" onClick={() => dialog.current?.showModal()}><FolderPlus size={17} /> Add category</button>
    <dialog className="account-dialog service-dialog" ref={dialog} aria-labelledby="create-inventory-category-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel"><div className="account-dialog-head"><span className="account-dialog-icon"><Tags size={22} /></span><div className="account-dialog-title"><h2 id="create-inventory-category-title">Create inventory category</h2><p>Group related items so stock is easier to find and report.</p></div><button className="icon-button" type="button" aria-label="Close category creator" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <form action={createInventoryCategoryAction} className="account-edit-form" ref={form}><div className="field"><label htmlFor="new-inventory-category-name">Category name</label><input className="input" id="new-inventory-category-name" name="name" maxLength={120} placeholder="Example: Cleaning chemicals" required /></div><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button><CreateButton /></div></form>
      </div>
    </dialog>
  </>;
}

export function InventoryCategoryCatalog({ categories }: { categories: Category[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase(); return needle ? categories.filter((category) => [category.name, category.isActive ? "active" : "archived", String(category._count.items)].some((value) => value.toLocaleLowerCase().includes(needle))) : categories; }, [categories, query]);
  return <div className="card service-catalog-card"><div className="card-head service-catalog-head"><div><h2>Inventory categories</h2><span className="service-result-count">{query ? `${filtered.length} of ${categories.length}` : `${categories.length} total`}</span></div><div className="catalog-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories…" aria-label="Search inventory categories" />{query && <button type="button" aria-label="Clear category search" onClick={() => setQuery("")}><X size={16} /></button>}</div></div>
    {!filtered.length ? <div className="empty service-search-empty"><Search size={27} /><strong>No matching categories</strong><span>Try another category name or status.</span><button className="btn btn-ghost" type="button" onClick={() => setQuery("")}>Clear search</button></div> : <div className="table-wrap record-table-wrap"><table className="record-table inventory-resource-table"><thead><tr><th>Category</th><th>Items</th><th>Created</th><th>Status</th><th>Manage</th></tr></thead><tbody>{filtered.map((category) => <tr key={category.id}><td data-label="Category"><strong>{category.name}</strong></td><td data-label="Items" className="amount">{category._count.items}</td><td data-label="Created">{formatDate(category.createdAt)}</td><td data-label="Status"><span className={`badge ${category.isActive ? "success" : "danger"}`}>{category.isActive ? "Active" : "Archived"}</span></td><td data-label="Manage"><CategoryManager category={category} /></td></tr>)}</tbody></table></div>}
  </div>;
}

function CategoryManager({ category }: { category: Category }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <><button className="btn btn-ghost btn-compact" type="button" onClick={() => dialog.current?.showModal()}><Pencil size={14} /> Manage</button>
    <dialog className="account-dialog service-dialog" ref={dialog} aria-labelledby={`manage-category-${category.id}`} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}><div className="account-dialog-panel"><div className="account-dialog-head"><span className="account-dialog-icon"><Tags size={22} /></span><div className="account-dialog-title"><h2 id={`manage-category-${category.id}`}>Manage category</h2><p>Rename the category or control whether it can be selected for new items.</p></div><button className="icon-button" type="button" aria-label="Close category editor" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      <form action={updateInventoryCategoryAction} className="account-edit-form"><input type="hidden" name="id" value={category.id} /><div className="account-form-grid"><div className="field account-field-full"><label htmlFor={`${category.id}-category-name`}>Category name</label><input className="input" id={`${category.id}-category-name`} name="name" defaultValue={category.name} maxLength={120} required /></div><div className="field account-field-full"><label htmlFor={`${category.id}-category-status`}>Status</label><select className="input" id={`${category.id}-category-status`} name="isActive" defaultValue={String(category.isActive)}><option value="true">Active — available for new items</option><option value="false">Archived — hidden from new items</option></select></div></div><div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button><SaveButton /></div></form>
      <div className="danger-zone"><div><strong>Delete category</strong><p>{category._count.items ? "This category contains items. Archive it to preserve their classification." : "This empty category can be permanently deleted."}</p></div><form action={deleteInventoryCategoryAction}><input type="hidden" name="id" value={category.id} /><ConfirmActionButton triggerLabel="Delete category" title={`Delete ${category.name}?`} description="This empty inventory category will be permanently removed." confirmLabel="Delete category" pendingLabel="Deleting…" disabled={category._count.items > 0} disabledReason="Archive categories that contain inventory items" /></form></div>
    </div></dialog>
  </>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)); }
function CreateButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><Plus size={16} />{pending ? "Creating…" : "Create category"}</button>; }
function SaveButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><Save size={15} />{pending ? "Saving…" : "Save changes"}</button>; }
