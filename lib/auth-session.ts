import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders } from "@/lib/request-security";
import { createSessionToken, isUsableSessionRecord, sessionTokenDigest } from "@/lib/session-token";

export const SESSION_TTL_SECONDS = 5 * 60;
export const SESSION_COOKIE_NAME = "swiftwash_session";

export function getClientIp(request: Request) {
  return clientIpFromHeaders(request.headers);
}

export async function createDatabaseSession(userId: string, request: Request) {
  const rawToken = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await prisma.session.create({ data: { userId, token: sessionTokenDigest(rawToken), expiresAt, ipAddress: getClientIp(request), userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null } });
  return { rawToken, expiresAt };
}

export function setSessionCookie(response: NextResponse, rawToken: string, expiresAt: Date) {
  response.cookies.set({ name: SESSION_COOKIE_NAME, value: rawToken, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: expiresAt, maxAge: SESSION_TTL_SECONDS, priority: "high" });
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
    select: { id: true, expiresAt: true, user: { select: { id: true, fullName: true, username: true, role: true, isActive: true } } },
  });
  if (!session || !isUsableSessionRecord(session.expiresAt, session.user.isActive)) return null;
  return session;
}

export async function revokeSessionToken(rawToken: string | null) {
  if (!rawToken) return;
  await prisma.session.deleteMany({ where: { token: sessionTokenDigest(rawToken) } });
}
