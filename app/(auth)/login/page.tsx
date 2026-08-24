import Image from "next/image";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { LoginForm } from "@/components/login-form";
import { getDashboardSnapshot, getReferenceData } from "@/lib/cached-data";
import { getCurrentUser } from "@/lib/session";
import companyLogo from "@/logo.jpeg";

export const metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "SUPERVISOR" ? "/pos" : "/dashboard");
  // Warm shared POS/admin data after the sign-in screen is sent. In normal use
  // this completes while staff enter credentials and never delays the page.
  after(() => Promise.all([getDashboardSnapshot(), getReferenceData()]).then(() => undefined).catch(() => undefined));
  return <main className="login-shell">
    <section className="login-card" aria-labelledby="login-title">
      <header className="login-card-head">
        <div className="login-logo-frame">
          <Image className="login-logo" src={companyLogo} alt="EcofriendLC" priority />
        </div>
        <p className="login-system-name">EcofriendLC POS</p>
        <h1 id="login-title">Welcome to EcofriendLC</h1>
        <p className="login-intro">Sign in to your account to manage car wash operations.</p>
      </header>
      {query.passwordChanged && <div className="alert alert-success">Password changed successfully. Sign in with your new password.</div>}
      <LoginForm />
      <footer className="login-card-footer">Need an account? <strong>Contact Administrator</strong></footer>
    </section>
  </main>;
}
