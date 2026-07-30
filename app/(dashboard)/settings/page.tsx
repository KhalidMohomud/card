import { KeyRound, Save, ShieldCheck, Store } from "lucide-react";
import { changeOwnPasswordAction, updateSettingsAction } from "@/app/actions";
import { Flash } from "@/components/flash";
import { getCatalogData } from "@/lib/cached-data";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(); const query = await searchParams; const { settings } = await getCatalogData();
  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">Single store</span><h1>Business settings</h1><p>Manage receipt information and administrator security.</p></div></div>
    <Flash success={query.success} error={query.error} />
    <div className="grid settings-grid">
      <form action={updateSettingsAction} className="card card-pad">
        <span className="stat-icon"><Store size={19} /></span><h2 style={{ marginTop: 15 }}>Store information</h2><p className="muted">These details appear on printed receipts.</p>
        <div className="form-grid" style={{ marginTop: 20 }}><div className="field full"><label>Business name</label><input className="input" name="businessName" defaultValue={settings?.businessName ?? "SwiftWash Car Wash"} required /></div><div className="field"><label>Phone</label><input className="input" name="phone" defaultValue={settings?.phone ?? ""} /></div><div className="field"><label>Email</label><input className="input" type="email" name="email" defaultValue={settings?.email ?? ""} /></div><div className="field full"><label>Address</label><input className="input" name="address" defaultValue={settings?.address ?? ""} /></div><div className="field"><label>Currency code</label><input className="input" name="currencyCode" maxLength={3} defaultValue={settings?.currencyCode ?? "USD"} required /></div><div className="field"><label>Receipt footer</label><input className="input" name="receiptFooter" defaultValue={settings?.receiptFooter ?? "Thank You"} required /></div><div className="field full"><label>Logo URL (optional)</label><input className="input" type="url" name="logoUrl" defaultValue={settings?.logoUrl ?? ""} /></div></div>
        <button className="btn btn-primary" style={{ marginTop: 18 }}><Save size={16} /> Save business settings</button>
      </form>
      <form action={changeOwnPasswordAction} className="card card-pad security-settings-card">
        <span className="stat-icon"><KeyRound size={19} /></span><h2 style={{ marginTop: 15 }}>Administrator password</h2><p className="muted">The password is stored only as a salted scrypt hash. Changing it signs out every active session.</p>
        <div className="field" style={{ marginTop: 20 }}><label htmlFor="current-password">Current password</label><input className="input" id="current-password" type="password" name="currentPassword" autoComplete="current-password" required /></div>
        <div className="field" style={{ marginTop: 14 }}><label htmlFor="new-password">New password</label><input className="input" id="new-password" type="password" name="newPassword" minLength={12} autoComplete="new-password" required /></div>
        <div className="field" style={{ marginTop: 14 }}><label htmlFor="confirm-password">Confirm new password</label><input className="input" id="confirm-password" type="password" name="confirmPassword" minLength={12} autoComplete="new-password" required /></div>
        <div className="password-requirements"><ShieldCheck size={17} /><span>Use 12+ characters with uppercase, lowercase, a number, and a symbol.</span></div>
        <button className="btn btn-primary btn-block"><KeyRound size={16} /> Change password and sign out</button>
      </form>
    </div>
  </div>;
}
