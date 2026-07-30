import { redirect } from "next/navigation";
import { after } from "next/server";
import { Droplets, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { getDashboardSnapshot, getReferenceData } from "@/lib/cached-data";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "SUPERVISOR" ? "/pos" : "/dashboard");
  // Warm shared POS/admin data after the sign-in screen is sent. In normal use
  // this completes while staff enter credentials and never delays the page.
  after(() => Promise.all([getDashboardSnapshot(), getReferenceData()]).then(() => undefined).catch(() => undefined));
  return <main className="login-shell">
    <section className="login-art"><div className="brand" style={{ border: 0, padding: 0 }}>
      <span className="brand-mark">
        <Droplets />
      </span>
      <span>
        <strong>Car</strong>
        <small>Operations POS</small>
      </span>
    </div>
      <div>
        <span className="eyebrow" style={{ color: "#6fe0b7" }}>One system. Every wash.</span>
        <h1>Clean cars.<br />Clear numbers.</h1>
        <p>Receipts, expenses, stock and daily performance—kept accurate from the wash bay to the back office.
        </p>
      </div><small style={{ color: "#8fb5a8" }}>Protected by secure, server-side sessions</small>
    </section>
    <section className="login-panel">
      <div className="login-card">
        <span className="stat-icon" style={{ marginBottom: 24 }}>
          <ShieldCheck size={20} /></span><h2>Welcome back</h2><p>Sign in with your staff username to continue.</p>{query.expired && <div className="alert alert-error">Your five-minute session expired. Please sign in again.</div>}{query.passwordChanged && <div className="alert alert-success">Password changed successfully. Sign in with your new password.</div>}<LoginForm /></div></section>
  </main>;
}
