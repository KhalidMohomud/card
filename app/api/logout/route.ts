import { after } from "next/server";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { clearSessionCookie, getRawSessionToken, isSameOriginRequest, readDatabaseSession, revokeSessionToken } from "@/lib/auth-session";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const [rawToken, session] = await Promise.all([getRawSessionToken(), readDatabaseSession()]);
  await revokeSessionToken(rawToken);
  const response = NextResponse.json({ success: true });
  response.headers.set("Cache-Control", "no-store"); clearSessionCookie(response);
  if (session) after(() => audit({ userId: session.user.id, action: "LOGOUT", entityType: "User", entityId: session.user.id }).catch(() => undefined));
  return response;
}
