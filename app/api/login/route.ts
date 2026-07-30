import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createDatabaseSession, getClientIp, isSameOriginRequest, setSessionCookie } from "@/lib/auth-session";
import { clearLoginFailures, loginBlockSeconds, loginThrottleKeys, registerLoginFailure } from "@/lib/login-throttle";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const input = z.object({
  username: z.string().trim().transform((value) => value.replace(/^@+/, "").toLowerCase()).pipe(z.string().min(3).max(30).regex(/^[a-z0-9_.]+$/)),
  password: z.string().min(1).max(128),
});
const DUMMY_PASSWORD_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

function noStore(response: NextResponse) { response.headers.set("Cache-Control", "no-store"); return response; }

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return noStore(NextResponse.json({ message: "Request rejected." }, { status: 403 }));
  let username = "unknown";
  try {
    const raw: unknown = await request.json();
    if (typeof raw === "object" && raw !== null && "password" in raw && typeof raw.password === "string" && raw.password.length > 128) {
      return noStore(NextResponse.json({ message: "Enter your account password, not the ADMIN_PASSWORD_HASH value." }, { status: 400 }));
    }
    const data = input.parse(raw); username = data.username;
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
      after(() => audit({ action: "LOGIN_FAILED", entityType: "User", newValues: { username, reason: user?.isActive === false ? "INACTIVE_OR_INVALID" : "INVALID_CREDENTIALS" } }).catch(() => undefined));
      const response = NextResponse.json({ message: nowBlocked ? "Too many sign-in attempts. Try again in 15 minutes." : "Invalid username or password." }, { status: nowBlocked ? 429 : 401 });
      if (nowBlocked) response.headers.set("Retry-After", String(15 * 60));
      return noStore(response);
    }

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
