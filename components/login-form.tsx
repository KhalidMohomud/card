"use client";

import { useState } from "react";
import { LockKeyhole, UserRound } from "lucide-react";

export function LoginForm() {
  const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      const body = await response.json();
      if (!response.ok) { setError(body.message ?? "Sign in failed."); return; }
      window.location.replace(body.user?.role === "SUPERVISOR" ? "/pos" : "/dashboard");
    } catch { setError("Unable to reach the server. Check your connection."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit}>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <div className="field"><label htmlFor="username">Username</label><div style={{ position: "relative" }}><UserRound size={18} style={{ position: "absolute", left: 14, top: 16, color: "#71817c" }} /><input className="input" style={{ paddingLeft: 43 }} id="username" name="username" autoComplete="username" placeholder="ayuub or @ayuub" required /></div></div>
    <div className="field"><label htmlFor="password">Password</label><div style={{ position: "relative" }}><LockKeyhole size={18} style={{ position: "absolute", left: 14, top: 16, color: "#71817c" }} /><input className="input" style={{ paddingLeft: 43 }} id="password" name="password" type="password" autoComplete="current-password" required /></div></div>
    <button className="btn btn-primary btn-block" style={{ minHeight: 50, marginTop: 10 }} disabled={pending}>{pending ? "Signing in…" : "Sign in securely"}</button>
  </form>;
}
