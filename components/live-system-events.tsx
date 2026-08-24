"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ConnectionState = "connecting" | "live" | "unavailable";

export function LiveSystemEvents() {
  const router = useRouter();
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    if (!("EventSource" in window)) {
      const unavailableTimer = setTimeout(() => setConnectionState("unavailable"), 0);
      return () => clearTimeout(unavailableTimer);
    }

    const source = new EventSource("/api/events");
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    source.onopen = () => setConnectionState("live");
    source.onerror = () => setConnectionState("connecting");
    source.addEventListener("connected", () => setConnectionState("live"));
    source.addEventListener("system-change", () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 350);
    });
    source.addEventListener("stream-unavailable", () => setConnectionState("connecting"));

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      source.close();
    };
  }, [router]);

  const label = connectionState === "live" ? "Live" : connectionState === "connecting" ? "Connecting" : "Unavailable";
  return <span className={`live-system-status live-system-status-${connectionState}`} role="status" aria-label={`System updates: ${label}`}>
    <span className="live-system-dot" aria-hidden="true" />
    <span>{label}</span>
  </span>;
}
