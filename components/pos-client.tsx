"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CreditCard, ShoppingCart } from "lucide-react";

type Service = { id: string; name: string; description: string | null; price: string };
type Payment = { id: string; name: string };

export function PosClient({ services, methods, currency }: { services: Service[]; methods: Payment[]; currency: string }) {
  const router = useRouter(); const [serviceId, setServiceId] = useState(""); const [paymentMethodId, setPaymentMethodId] = useState(""); const [reference, setReference] = useState(""); const [key] = useState(() => crypto.randomUUID()); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const selected = services.find((service) => service.id === serviceId);
  async function checkout() {
    if (!serviceId || !paymentMethodId || pending) return; setPending(true); setError("");
    try {
      const response = await fetch("/api/receipts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ serviceId, paymentMethodId, paymentReference: reference || undefined, idempotencyKey: key }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.message);
      router.push(`/receipts/${body.id}/print`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to complete the sale."); setPending(false); }
  }
  return <div className="pos-layout">
    <section><div className="page-head"><div><span className="eyebrow">Step 1</span><h1>Choose a service</h1><p>Prices are loaded directly from your service catalogue.</p></div></div>
      {!services.length ? <div className="card empty">No active services. Ask an administrator to activate one.</div> : <div className="service-grid">{services.map((service) => <button type="button" className={`service-card ${serviceId === service.id ? "selected" : ""}`} onClick={() => setServiceId(service.id)} key={service.id}><strong>{service.name}</strong><small className="muted">{service.description || "Car wash service"}</small><span>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(service.price))}</span></button>)}</div>}
    </section>
    <aside className="card checkout"><span className="eyebrow">Step 2</span><h2>Complete sale</h2><div className="checkout-row"><span className="muted">Service</span><strong>{selected?.name ?? "Not selected"}</strong></div><div className="checkout-row"><span className="muted">Total</span><strong style={{ fontSize: 22 }}>{selected ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(selected.price)) : "—"}</strong></div>
      <div style={{ marginTop: 18 }}><span className="eyebrow">Payment method</span><div className="pay-grid">{methods.map((method) => <button type="button" className={`pay-option ${paymentMethodId === method.id ? "selected" : ""}`} onClick={() => setPaymentMethodId(method.id)} key={method.id}>{paymentMethodId === method.id ? <Check size={15} style={{ display: "inline", marginRight: 5 }} /> : <CreditCard size={15} style={{ display: "inline", marginRight: 5 }} />}{method.name}</button>)}</div></div>
      <div className="field"><label htmlFor="reference">Payment reference (optional)</label><input id="reference" className="input" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} /></div>
      {error && <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div>}
      <button className="btn btn-primary btn-block" style={{ minHeight: 54, marginTop: 18 }} onClick={checkout} disabled={!serviceId || !paymentMethodId || pending}>{pending ? "Saving receipt…" : <><ShoppingCart size={18} /> Complete & print <ArrowRight size={17} /></>}</button>
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>The server verifies the live service price and saves this receipt only once.</p>
    </aside>
  </div>;
}
