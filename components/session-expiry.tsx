"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

export function SessionExpiry({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const loggingOut = useRef(false);

  useEffect(() => {
    async function expire() {
      if (loggingOut.current) return;
      loggingOut.current = true;
      try { await fetch("/api/logout", { method: "POST" }); } catch { /* Navigation still clears the expired browser cookie. */ }
      localStorage.setItem("swiftwash:logout", String(Date.now()));
      window.location.replace("/login?expired=1");
    }
    function update() {
      const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(seconds); if (seconds === 0) void expire();
    }
    const syncLogout = (event: StorageEvent) => { if (event.key === "swiftwash:logout") window.location.replace("/login"); };
    update(); const interval = window.setInterval(update, 1000); window.addEventListener("storage", syncLogout);
    return () => { window.clearInterval(interval); window.removeEventListener("storage", syncLogout); };
  }, [expiresAt]);

  const display = remaining === null ? "5:00" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return <span className={`badge session-expiry ${remaining !== null && remaining <= 60 ? "warning" : "success"}`} title="Automatic logout when this countdown reaches zero"><ShieldCheck size={12} /> Session {display}</span>;
}
