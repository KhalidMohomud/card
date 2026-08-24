import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders } from "@/lib/request-security";
import { createSessionToken, isUsableSessionRecord, sessionTokenDigest } from "@/lib/session-token";
import { nextSessionExpiresAt, sessionAbsoluteExpiresAt, SESSION_IDLE_TTL_SECONDS, shouldRenewSession } from "@/lib/session-policy";

export const SESSION_TTL_SECONDS = SESSION_IDLE_TTL_SECONDS;
export const SESSION_COOKIE_NAME = "swiftwash_session";

export function getClientIp(request: Request) {
  return clientIpFromHeaders(request.headers);
}

export async function createDatabaseSession(userId: string, request: Request) {
  const rawToken = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_IDLE_TTL_SECONDS * 1_000);
  await prisma.session.create({ data: { userId, token: sessionTokenDigest(rawToken), expiresAt, ipAddress: getClientIp(request), userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null } });
  return { rawToken, expiresAt };
}

export function setSessionCookie(response: NextResponse, rawToken: string, expiresAt: Date) {
  const maxAge = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1_000));
  response.cookies.set({ name: SESSION_COOKIE_NAME, value: rawToken, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: expiresAt, maxAge, priority: "high" });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: new Date(0), maxAge: 0, priority: "high" });
  for (const legacyName of ["swiftwash.session_token", "swiftwash.session_data"]) response.cookies.set({ name: legacyName, value: "", path: "/", expires: new Date(0), maxAge: 0 });
}

export async function getRawSessionToken() {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function readDatabaseSession() {
  const rawToken = await getRawSessionToken();
  if (!rawToken) return null;
  const session = await prisma.session.findUnique({
    where: { token: sessionTokenDigest(rawToken) },
    select: { id: true, createdAt: true, expiresAt: true, user: { select: { id: true, fullName: true, username: true, role: true, isActive: true } } },
  });
  if (!session || !isUsableSessionRecord(session.expiresAt, session.user.isActive, Date.now(), session.createdAt)) return null;
  return session;
}

export type SessionRenewalResult =
  | { status: "missing" }
  | { status: "stale" }
  | { status: "expired" }
  | { status: "conflict" }
  | { status: "current"; expiresAt: Date; absoluteExpiresAt: Date }
  | { status: "renewed"; sessionId: string; userId: string; rawToken: string; expiresAt: Date; absoluteExpiresAt: Date };

export async function renewDatabaseSession(rawToken: string | null): Promise<SessionRenewalResult> {
  if (!rawToken) return { status: "missing" };
  const token = sessionTokenDigest(rawToken);
  const session = await prisma.session.findUnique({
    where: { token },
    select: { id: true, userId: true, createdAt: true, expiresAt: true, user: { select: { isActive: true } } },
  });
  if (!session) return { status: "stale" };

  const now = Date.now();
  const absoluteExpiresAt = sessionAbsoluteExpiresAt(session.createdAt);
  if (!isUsableSessionRecord(session.expiresAt, session.user.isActive, now, session.createdAt)) {
    await prisma.session.deleteMany({ where: { id: session.id, token } });
    return { status: "expired" };
  }
  if (!shouldRenewSession(session.expiresAt, now)) {
    return { status: "current", expiresAt: session.expiresAt, absoluteExpiresAt };
  }

  const rotatedToken = createSessionToken();
  const expiresAt = nextSessionExpiresAt(session.createdAt, now);
  const updated = await prisma.session.updateMany({
    where: { id: session.id, token, expiresAt: { gt: new Date(now) } },
    data: { token: sessionTokenDigest(rotatedToken), expiresAt },
  });
  if (updated.count !== 1) return { status: "conflict" };
  return { status: "renewed", sessionId: session.id, userId: session.userId, rawToken: rotatedToken, expiresAt, absoluteExpiresAt };
}

export async function revokeSessionToken(rawToken: string | null) {
  if (!rawToken) return;
  await prisma.session.deleteMany({ where: { token: sessionTokenDigest(rawToken) } });
}
