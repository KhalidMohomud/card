import { NextResponse } from "next/server";
import { after } from "next/server";
import { audit } from "@/lib/audit";
import { createDatabaseSession, getClientIp, getRawSessionToken, revokeSessionToken, setSessionCookie } from "@/lib/auth-session";
import { clearLoginFailures, loginBlockSeconds, loginThrottleKeys, registerLoginFailure, usernameThrottleKey } from "@/lib/login-throttle";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { hasJsonContentType, isSameOriginMutation, readLimitedJson, RequestBodyTooLargeError } from "@/lib/request-security";
import { loginInput } from "@/lib/validation";

const DUMMY_PASSWORD_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

function noStore(response: NextResponse) { response.headers.set("Cache-Control", "no-store"); return response; }

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return noStore(NextResponse.json({ message: "Request rejected." }, { status: 403 }));
  if (!hasJsonContentType(request)) return noStore(NextResponse.json({ message: "Invalid request." }, { status: 415 }));
  let raw: unknown;
  try {
    raw = await readLimitedJson(request, 2 * 1024);
  } catch (error) {
    after(() => audit({ action: "LOGIN_REJECTED", entityType: "User", newValues: { reason: error instanceof RequestBodyTooLargeError ? "BODY_TOO_LARGE" : "MALFORMED_JSON" } }).catch(() => undefined));
    return noStore(NextResponse.json(
      { message: error instanceof RequestBodyTooLargeError ? "Request body is too large." : "Invalid request." },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 },
    ));
  }
  const parsed = loginInput.safeParse(raw);
  if (!parsed.success) {
    after(() => audit({ action: "LOGIN_REJECTED", entityType: "User", newValues: { reason: "INVALID_INPUT" } }).catch(() => undefined));
    return noStore(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  const data = parsed.data;
  const username = data.username;
  try {
    const keys = loginThrottleKeys(username, getClientIp(request));
    const retryAfter = await loginBlockSeconds(keys);
    if (retryAfter) {
      const response = NextResponse.json({ message: "Too many sign-in attempts. Try again later." }, { status: 429 });
      response.headers.set("Retry-After", String(retryAfter));
      return noStore(response);
    }
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, fullName: true, username: true, role: true, isActive: true, accounts: { where: { providerId: "credential" }, take: 1, select: { password: true } } } });
    const passwordMatches = await verifyPassword(user?.accounts[0]?.password ?? DUMMY_PASSWORD_HASH, data.password);
    if (!user || !user.isActive || !passwordMatches) {
      const nowBlocked = await registerLoginFailure(keys);
      if (nowBlocked) {
        after(() => audit({ action: "LOGIN_BLOCKED", entityType: "User", newValues: { username, reason: "BRUTE_FORCE_PROTECTION", durationMinutes: 15 } }).catch(() => undefined));
        const response = NextResponse.json({ message: "Too many failed sign-in attempts. Try again in 15 minutes." }, { status: 429 });
        response.headers.set("Retry-After", String(15 * 60));
        return noStore(response);
      }
      after(() => audit({ action: "LOGIN_FAILED", entityType: "User", newValues: { username, reason: user?.isActive === false ? "INACTIVE_OR_INVALID" : "INVALID_CREDENTIALS" } }).catch(() => undefined));
      return noStore(NextResponse.json({ message: "Invalid username or password." }, { status: 401 }));
    }

    // A successful sign-in replaces any session already presented by this
    // browser, preventing stale or attacker-supplied tokens from surviving.
    await revokeSessionToken(await getRawSessionToken());
    const session = await createDatabaseSession(user.id, request);
    // A valid login clears only that username's failures. The shared IP
    // counter remains intact so an attacker cannot reset it with another account.
    await clearLoginFailures([usernameThrottleKey(keys)]);
    const response = NextResponse.json({ user: { id: user.id, fullName: user.fullName, username: user.username, role: user.role }, expiresAt: session.expiresAt.toISOString() });
    setSessionCookie(response, session.rawToken, session.expiresAt); clearSessionCookieLegacyOnly(response);
    after(() => Promise.all([
      audit({ userId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id }),
      prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
      prisma.loginThrottle.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    ]).then(() => undefined).catch(() => undefined));
    return noStore(response);
  } catch (error) {
    console.error("Login request failed", { error: error instanceof Error ? error.name : "UnknownError" });
    after(() => audit({ action: "LOGIN_ERROR", entityType: "User", newValues: { username, reason: "INTERNAL_ERROR" } }).catch(() => undefined));
    return noStore(NextResponse.json({ message: "Sign in is temporarily unavailable. Try again." }, { status: 503 }));
  }
}

function clearSessionCookieLegacyOnly(response: NextResponse) {
  for (const name of ["swiftwash.session_token", "swiftwash.session_data"]) response.cookies.set({ name, value: "", path: "/", expires: new Date(0), maxAge: 0 });
}
