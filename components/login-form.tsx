"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";

export function LoginForm() {
  const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [showPassword, setShowPassword] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length > 128) { setError("Enter your account password, not the ADMIN_PASSWORD_HASH value."); setPending(false); return; }
    try {
      const response = await fetch("/api/login",
        {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: form.get("username"), password })
        });
      const body = await response.json();
      if (!response.ok) { setError(body.message ?? "Sign in failed."); return; }
      window.location.replace(body.user?.role === "SUPERVISOR" ? "/pos" : "/dashboard");
    }
    catch {
      setError("Unable to reach the server. Check your connection.");

    }
    finally {
      setPending(false);

    }
  }
  return <form onSubmit={submit}>
    {error && <div className="alert alert-error" role="alert">{error}
    </div>}
    <div className="field">
      <label htmlFor="username">Username</label>
      <div style={{ position: "relative" }}>
        <UserRound size={18} style={{ position: "absolute", left: 14, top: 16, color: "#71849a" }} />
        <input className="input" style={{ paddingLeft: 43 }} id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="ayuub or @ayuub" required />
      </div>
    </div>
    <div className="field">
      <label htmlFor="password">Password</label>
      <div style={{ position: "relative" }}>
        <LockKeyhole size={18} style={{ position: "absolute", left: 14, top: 16, color: "#71849a" }} />
        <input className="input" style={{ paddingLeft: 43, paddingRight: 46 }} id="password" name="password" type={showPassword ? "text" : "password"} maxLength={128} autoComplete="current-password" required />
        <button className="password-visibility" type="button" aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ?
            <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

    </div>
    <button className="btn btn-primary btn-block" style={{ minHeight: 50, marginTop: 10 }} disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>

  </form>;
}
