import { after, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { clearSessionCookie, getRawSessionToken, renewDatabaseSession, setSessionCookie } from "@/lib/auth-session";
import { isSameOriginMutation } from "@/lib/request-security";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function unauthorized() {
  const response = NextResponse.json({ message: "Session expired." }, { status: 401 });
  clearSessionCookie(response);
  return noStore(response);
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return noStore(NextResponse.json({ message: "Request rejected." }, { status: 403 }));

  const result = await renewDatabaseSession(await getRawSessionToken());
  if (result.status === "missing" || result.status === "expired") return unauthorized();
  if (result.status === "stale" || result.status === "conflict") {
    const response = NextResponse.json({ message: "Session renewal is already in progress." }, { status: 409 });
    response.headers.set("Retry-After", "1");
    return noStore(response);
  }
  if (result.status === "current") {
    return noStore(NextResponse.json({ renewed: false, expiresAt: result.expiresAt.toISOString(), absoluteExpiresAt: result.absoluteExpiresAt.toISOString() }));
  }

  const response = NextResponse.json({ renewed: true, expiresAt: result.expiresAt.toISOString(), absoluteExpiresAt: result.absoluteExpiresAt.toISOString() });
  setSessionCookie(response, result.rawToken, result.expiresAt);
  after(() => audit({
    userId: result.userId,
    action: "SESSION_RENEWED",
    entityType: "Session",
    entityId: result.sessionId,
    newValues: { expiresAt: result.expiresAt.toISOString(), absoluteExpiresAt: result.absoluteExpiresAt.toISOString() },
  }).catch(() => undefined));
  return noStore(response);
}
