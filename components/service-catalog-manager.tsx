"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Save, Search, Sparkles, X } from "lucide-react";
import { updateServiceAction } from "@/app/actions";

type Service = { id: string; name: string; price: string; description: string | null; isActive: boolean };

export function ServiceCatalogManager({ services, currencyCode = "USD" }: { services: Service[]; currencyCode?: string }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return services;
    return services.filter((service) => [service.name, service.description ?? "", service.isActive ? "active" : "inactive", service.price].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [query, services]);

  return <div className="card service-catalog-card">
    <div className="card-head service-catalog-head"><div><h2>Services</h2><span className="service-result-count">{query ? `${filtered.length} of ${services.length}` : `${services.length} total`}</span></div><div className="catalog-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services…" aria-label="Search services" />{query && <button type="button" aria-label="Clear service search" onClick={() => setQuery("")}><X size={16} /></button>}</div></div>
    {!filtered.length ? <div className="empty service-search-empty"><Search size={27} /><strong>No matching services</strong><span>Try another name, description, status, or price.</span><button className="btn btn-ghost" type="button" onClick={() => setQuery("")}>Clear search</button></div> : <div className="table-wrap record-table-wrap"><table className="record-table service-table"><thead><tr><th>Service</th><th>Price</th><th>Status</th><th>Manage</th></tr></thead><tbody>{filtered.map((service) => <tr key={service.id}><td data-label="Service"><div className="service-name-cell"><strong>{service.name}</strong><small>{service.description || "No description"}</small></div></td><td data-label="Price" className="amount">{formatServicePrice(service.price, currencyCode)}</td><td data-label="Status"><span className={`badge ${service.isActive ? "success" : ""}`}>{service.isActive ? "Active" : "Inactive"}</span></td><td data-label="Manage"><ServiceManager service={service} /></td></tr>)}</tbody></table></div>}
  </div>;
}

function ServiceManager({ service }: { service: Service }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = `manage-service-${service.id}`;
  return <>
    <button className="btn btn-ghost btn-compact" type="button" onClick={() => dialog.current?.showModal()}><Pencil size={14} /> Manage</button>
    <dialog className="account-dialog service-dialog" ref={dialog} aria-labelledby={titleId} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head"><span className="account-dialog-icon"><Sparkles size={21} /></span><div className="account-dialog-title"><h2 id={titleId}>Edit service</h2><p>Update the POS option without changing old receipts.</p></div><button className="icon-button" type="button" aria-label="Close service editor" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <form action={updateServiceAction} className="account-edit-form">
          <input type="hidden" name="id" value={service.id} />
          <div className="account-form-grid">
            <div className="field account-field-full"><label htmlFor={`${service.id}-name`}>Service name</label><input className="input" id={`${service.id}-name`} name="name" defaultValue={service.name} required /></div>
            <div className="field"><label htmlFor={`${service.id}-price`}>Price</label><input className="input" id={`${service.id}-price`} name="price" inputMode="decimal" defaultValue={service.price} required /></div>
            <div className="field"><label htmlFor={`${service.id}-status`}>POS availability</label><select className="input" id={`${service.id}-status`} name="isActive" defaultValue={String(service.isActive)}><option value="true">Active — show in POS</option><option value="false">Inactive — hide from POS</option></select></div>
            <div className="field account-field-full"><label htmlFor={`${service.id}-description`}>Description <span className="muted">— optional</span></label><textarea className="input" id={`${service.id}-description`} name="description" defaultValue={service.description ?? ""} /></div>
          </div>
          <div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button><SaveButton /></div>
        </form>
      </div>
    </dialog>
  </>;
}

function formatServicePrice(value: string, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(value)); }
function SaveButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><Save size={15} />{pending ? "Saving…" : "Save changes"}</button>; }
