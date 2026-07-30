import { Save, Store } from "lucide-react";
import { updateSettingsAction } from "@/app/actions";
import { Flash } from "@/components/flash";
import { getCatalogData } from "@/lib/cached-data";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Settings" };
export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(); const query = await searchParams; const { settings } = await getCatalogData();
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Single store</span><h1>Business settings</h1><p>This information appears on printed receipts.</p></div></div><Flash success={query.success} error={query.error} /><form action={updateSettingsAction} className="card card-pad" style={{ maxWidth: 760 }}><span className="stat-icon"><Store size={19} /></span><div className="form-grid" style={{ marginTop: 20 }}><div className="field full"><label>Business name</label>
    <input className="input" name="businessName" defaultValue={settings?.businessName ?? "SwiftWash Car Wash"} required />
  </div><div className="field"><label>Phone</label>

      <input className="input" name="phone" defaultValue={settings?.phone ?? ""} />
    </div>
    <div className="field">
      <label>Email</label>
      <input className="input" type="email" name="email" defaultValue={settings?.email ?? ""} />
    </div>
    <div className="field full">
      <label>Address</label>
      <input className="input" name="address" defaultValue={settings?.address ?? ""} />
    </div><div className="field">
      <label>Currency code</label>
      <input className="input" name="currencyCode" maxLength={3} defaultValue={settings?.currencyCode ?? "USD"} required />
    </div><div className="field">
      <label>Receipt footer</label>
      <input className="input" name="receiptFooter" defaultValue={settings?.receiptFooter ?? "Thank You"} required /></div>
    <div className="field full"><label>Logo URL (optional)</label>
      <input className="input" type="url" name="logoUrl" defaultValue={settings?.logoUrl ?? ""} />
    </div>
  </div>


    <button className="btn btn-primary" style={{ marginTop: 18 }}><Save size={16} /> Save business settings</button>


  </form>

  </div>;
}
