"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { SESSION_IDLE_TTL_SECONDS, SESSION_RECENT_ACTIVITY_SECONDS, SESSION_RENEWAL_WINDOW_SECONDS } from "@/lib/session-policy";

const RENEWAL_LOCK_KEY = "swiftwash:session-renewal-lock";
const RENEWED_EVENT_KEY = "swiftwash:session-renewed";
const RENEWAL_LOCK_MS = 10_000;

export function SessionExpiry({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const loggingOut = useRef(false);

  useEffect(() => {
    let activeExpiresAt = new Date(expiresAt).getTime();
    let lastActivityAt = Date.now();
    let renewing = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const tabId = crypto.randomUUID();

    async function expire() {
      if (loggingOut.current) return;
      loggingOut.current = true;
      try { await fetch("/api/logout", { method: "POST" }); } catch { /* Navigation still clears the expired browser cookie. */ }
      localStorage.setItem("swiftwash:logout", String(Date.now()));
      window.location.replace("/login?expired=1");
    }

    function acquireRenewalLock() {
      try {
        const now = Date.now();
        const existing = localStorage.getItem(RENEWAL_LOCK_KEY)?.split(":") ?? [];
        if (Number(existing[1]) > now) return false;
        const lock = `${tabId}:${now + RENEWAL_LOCK_MS}`;
        localStorage.setItem(RENEWAL_LOCK_KEY, lock);
        return localStorage.getItem(RENEWAL_LOCK_KEY) === lock;
      } catch {
        return true;
      }
    }

    function releaseRenewalLock() {
      try {
        if (localStorage.getItem(RENEWAL_LOCK_KEY)?.startsWith(`${tabId}:`)) localStorage.removeItem(RENEWAL_LOCK_KEY);
      } catch { /* Storage may be disabled by the browser. */ }
    }

    function acceptRenewal(nextExpiry: number, broadcast = true) {
      if (!Number.isFinite(nextExpiry) || nextExpiry <= Date.now()) return;
      activeExpiresAt = nextExpiry;
      if (!broadcast) return;
      try { localStorage.setItem(RENEWED_EVENT_KEY, String(nextExpiry)); } catch { /* Other tabs will renew independently. */ }
    }

    async function renew() {
      const now = Date.now();
      const remainingMs = activeExpiresAt - now;
      if (renewing || document.visibilityState !== "visible" || now - lastActivityAt > SESSION_RECENT_ACTIVITY_SECONDS * 1_000 || remainingMs <= 0 || remainingMs > SESSION_RENEWAL_WINDOW_SECONDS * 1_000) return;
      if (!acquireRenewalLock()) return;
      renewing = true;
      try {
        const response = await fetch("/api/session/renew", { method: "POST" });
        if (response.ok) {
          const payload = await response.json() as { expiresAt?: string };
          acceptRenewal(new Date(payload.expiresAt ?? "").getTime());
        } else if (response.status === 401) {
          await expire();
        } else if (response.status === 409) {
          retryTimer = setTimeout(() => void renew(), 1_500);
        }
      } catch { /* The countdown remains authoritative during temporary network failures. */ }
      finally {
        renewing = false;
        releaseRenewalLock();
      }
    }

    function update() {
      const seconds = Math.max(0, Math.ceil((activeExpiresAt - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) void expire();
      else void renew();
    }

    const recordActivity = () => { lastActivityAt = Date.now(); void renew(); };
    const recordVisibleActivity = () => { if (document.visibilityState === "visible") recordActivity(); };
    const syncSession = (event: StorageEvent) => {
      if (event.key === "swiftwash:logout") window.location.replace("/login");
      if (event.key === RENEWED_EVENT_KEY) acceptRenewal(Number(event.newValue), false);
    };
    update();
    const interval = window.setInterval(update, 1_000);
    window.addEventListener("storage", syncSession);
    window.addEventListener("pointerdown", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("touchstart", recordActivity, { passive: true });
    document.addEventListener("visibilitychange", recordVisibleActivity);
    return () => {
      window.clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
      releaseRenewalLock();
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("pointerdown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("touchstart", recordActivity);
      document.removeEventListener("visibilitychange", recordVisibleActivity);
    };
  }, [expiresAt]);

  const display = remaining === null ? `${SESSION_IDLE_TTL_SECONDS / 60}:00` : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return <span className={`badge session-expiry ${remaining !== null && remaining <= 60 ? "warning" : "success"}`} title="Automatically renews after activity and signs out after inactivity"><ShieldCheck size={12} /> Session {display}</span>;
}
