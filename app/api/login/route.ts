import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { after } from "next/server";
import { z } from "zod";

const input = z.object({
  username: z.string().trim().transform((value) => value.replace(/^@+/, "").toLowerCase()).pipe(z.string().min(3).max(30).regex(/^[a-z0-9_.]+$/)),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  let username = "unknown";
  try {
    const data = input.parse(await request.json()); username = data.username;
    const response = await auth.api.signInUsername({ body: data, headers: request.headers, asResponse: true });
    if (!response.ok) {
      after(() => audit({ action: "LOGIN_FAILED", entityType: "User", newValues: { username, reason: "INVALID_OR_INACTIVE" } }).catch(() => undefined));
      return Response.json({ message: "Invalid username or password." }, { status: response.status });
    }
    const body = await response.clone().json() as { user?: { id?: string; role?: string } };
    const userId = body.user?.id;
    after(() => audit({ userId, action: "LOGIN_SUCCESS", entityType: "User", entityId: userId }).catch(() => undefined));
    return response;
  } catch {
    after(() => audit({ action: "LOGIN_FAILED", entityType: "User", newValues: { username, reason: "INVALID_REQUEST" } }).catch(() => undefined));
    return Response.json({ message: "Invalid username or password." }, { status: 401 });
  }
}
