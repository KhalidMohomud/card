import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getFreshCurrentUser } from "@/lib/session";
import { formatSseComment, formatSseEvent } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLL_INTERVAL_MS = 4_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const STREAM_LIFETIME_MS = 50_000;
const RECONNECT_DELAY_MS = 2_500;

async function latestAuditEvent() {
  return prisma.auditLog.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, createdAt: true },
  });
}

export async function GET(request: Request) {
  const user = await getFreshCurrentUser();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    response.headers.set("Cache-Control", "no-store");
    clearSessionCookie(response);
    return response;
  }

  const latest = await latestAuditEvent();
  const suppliedLastEventId = request.headers.get("last-event-id")?.trim() ?? "";
  const lastEventId = /^[a-zA-Z0-9_-]{1,200}$/.test(suppliedLastEventId) ? suppliedLastEventId : null;
  const missedChange = Boolean(lastEventId && latest && lastEventId !== latest.id);
  let cursor = latest?.id ?? null;
  const encoder = new TextEncoder();
  let dispose = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let active = true;
      let polling = false;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let lifetimeTimer: ReturnType<typeof setTimeout> | null = null;

      const stop = (closeController: boolean) => {
        if (!active) return;
        active = false;
        if (pollTimer) clearInterval(pollTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (lifetimeTimer) clearTimeout(lifetimeTimer);
        request.signal.removeEventListener("abort", onAbort);
        if (closeController) {
          try { controller.close(); } catch { /* The browser already closed the stream. */ }
        }
      };

      const enqueue = (message: string) => {
        if (!active) return;
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          stop(false);
        }
      };

      const poll = async () => {
        if (!active || polling) return;
        polling = true;
        try {
          const newest = await latestAuditEvent();
          if (newest && newest.id !== cursor) {
            cursor = newest.id;
            enqueue(formatSseEvent("system-change", { changedAt: newest.createdAt.toISOString() }, { id: newest.id }));
          }
        } catch {
          enqueue(formatSseEvent("stream-unavailable", { reconnecting: true }));
          stop(true);
        } finally {
          polling = false;
        }
      };

      const onAbort = () => stop(false);
      request.signal.addEventListener("abort", onAbort, { once: true });
      dispose = () => stop(false);

      enqueue(formatSseEvent("connected", { connected: true }, { retry: RECONNECT_DELAY_MS }));
      if (missedChange && latest) {
        enqueue(formatSseEvent("system-change", { changedAt: latest.createdAt.toISOString() }, { id: latest.id }));
      }

      pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
      heartbeatTimer = setInterval(() => enqueue(formatSseComment(`heartbeat ${new Date().toISOString()}`)), HEARTBEAT_INTERVAL_MS);
      lifetimeTimer = setTimeout(() => stop(true), STREAM_LIFETIME_MS);
    },
    cancel() {
      dispose();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
