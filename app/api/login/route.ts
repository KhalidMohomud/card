import { NextResponse } from "next/server";
import { after } from "next/server";
import { audit } from "@/lib/audit";
import { createDatabaseSession, getClientIp, getRawSessionToken, revokeSessionToken, setSessionCookie } from "@/lib/auth-session";
import { clearLoginFailures, loginBlockSeconds, loginThrottleKeys, registerLoginAttempt } from "@/lib/login-throttle";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { hasJsonContentType, isSameOriginMutation } from "@/lib/request-security";
import { loginInput } from "@/lib/validation";

const DUMMY_PASSWORD_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

function noStore(response: NextResponse) { response.headers.set("Cache-Control", "no-store"); return response; }

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return noStore(NextResponse.json({ message: "Request rejected." }, { status: 403 }));
  if (!hasJsonContentType(request)) return noStore(NextResponse.json({ message: "Invalid request." }, { status: 415 }));
  let username = "unknown";
  try {
    const raw: unknown = await request.json();
    const data = loginInput.parse(raw); username = data.username;
    const keys = loginThrottleKeys(username, getClientIp(request));
    const retryAfter = await loginBlockSeconds(keys);
    if (retryAfter) {
      const response = NextResponse.json({ message: "Too many sign-in attempts. Try again later." }, { status: 429 });
      response.headers.set("Retry-After", String(retryAfter));
      return noStore(response);
    }
    const nowBlocked = await registerLoginAttempt(keys);
    if (nowBlocked) {
      after(() => audit({ action: "LOGIN_BLOCKED", entityType: "User", newValues: { username, reason: "RATE_LIMIT" } }).catch(() => undefined));
      const response = NextResponse.json({ message: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });
      response.headers.set("Retry-After", String(15 * 60));
      return noStore(response);
    }

    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, fullName: true, username: true, role: true, isActive: true, accounts: { where: { providerId: "credential" }, take: 1, select: { password: true } } } });
    const passwordMatches = await verifyPassword(user?.accounts[0]?.password ?? DUMMY_PASSWORD_HASH, data.password);
    if (!user || !user.isActive || !passwordMatches) {
      after(() => audit({ action: "LOGIN_FAILED", entityType: "User", newValues: { username, reason: user?.isActive === false ? "INACTIVE_OR_INVALID" : "INVALID_CREDENTIALS" } }).catch(() => undefined));
      return noStore(NextResponse.json({ message: "Invalid username or password." }, { status: 401 }));
    }

    // A successful sign-in replaces any session already presented by this
    // browser, preventing stale or attacker-supplied tokens from surviving.
    await revokeSessionToken(await getRawSessionToken());
    const session = await createDatabaseSession(user.id, request);
    await clearLoginFailures(keys);
    const response = NextResponse.json({ user: { id: user.id, fullName: user.fullName, username: user.username, role: user.role }, expiresAt: session.expiresAt.toISOString() });
    setSessionCookie(response, session.rawToken, session.expiresAt); clearSessionCookieLegacyOnly(response);
    after(() => Promise.all([
      audit({ userId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id }),
      prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
      prisma.loginThrottle.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    ]).then(() => undefined).catch(() => undefined));
    return noStore(response);
  } catch {
    after(() => audit({ action: "LOGIN_FAILED", entityType: "User", newValues: { username, reason: "INVALID_REQUEST" } }).catch(() => undefined));
    return noStore(NextResponse.json({ message: "Invalid username or password." }, { status: 401 }));
  }
}

function clearSessionCookieLegacyOnly(response: NextResponse) {
  for (const name of ["swiftwash.session_token", "swiftwash.session_data"]) response.cookies.set({ name, value: "", path: "/", expires: new Date(0), maxAge: 0 });
}
