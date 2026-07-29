import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { after } from "next/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const response = await auth.api.signOut({ headers: request.headers, asResponse: true });
  if (user) after(() => audit({ userId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id }).catch(() => undefined));
  return response;
}
