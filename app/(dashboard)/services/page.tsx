import { CreditCard, Plus, Sparkles } from "lucide-react";
import { createPaymentMethodAction, createServiceAction, togglePaymentMethodAction } from "@/app/actions";
import { Flash } from "@/components/flash";
import { ServiceCatalogManager } from "@/components/service-catalog-manager";
import { getCatalogData } from "@/lib/cached-data";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Services" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const query = await searchParams;
  const { services, methods, settings } = await getCatalogData();

  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">Catalogue</span><h1>Services & payments</h1><p>Search and manage POS choices without changing historical receipts.</p></div></div>
    <Flash success={query.success} error={query.error} />
    <div className="grid two-grid">
      <ServiceCatalogManager services={services} currencyCode={settings?.currencyCode} />
      <div className="grid">
        <form action={createServiceAction} className="card card-pad">
          <div className="card-head" style={{ padding: 0, marginBottom: 18 }}><h2><Sparkles size={17} style={{ display: "inline", marginRight: 7 }} /> Add service</h2></div>
          <div className="field"><label htmlFor="new-service-name">Name</label><input className="input" id="new-service-name" name="name" required /></div>
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="new-service-price">Price</label><input className="input" id="new-service-price" name="price" inputMode="decimal" placeholder="0.00" required /></div>
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="new-service-description">Description</label><textarea className="input" id="new-service-description" name="description" /></div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 15 }}><Plus size={16} /> Add service</button>
        </form>
        <div className="card card-pad">
          <div className="card-head" style={{ padding: 0, marginBottom: 14 }}><h2><CreditCard size={17} style={{ display: "inline", marginRight: 7 }} /> Payment methods</h2></div>
          {methods.map((method) => <div className="checkout-row" key={method.id}><span>{method.name}</span><form action={togglePaymentMethodAction}><input type="hidden" name="id" value={method.id} /><input type="hidden" name="isActive" value={String(!method.isActive)} /><button className={`btn ${method.isActive ? "btn-ghost" : "btn-soft"}`}>{method.isActive ? "Deactivate" : "Activate"}</button></form></div>)}
          <form action={createPaymentMethodAction} className="inline-form" style={{ marginTop: 15 }}><input className="input" name="name" placeholder="New payment method" aria-label="New payment method name" required /><button className="btn btn-primary" aria-label="Add payment method"><Plus size={15} /></button></form>
        </div>
      </div>
    </div>
  </div>;
}
