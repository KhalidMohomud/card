import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";

const input = z.object({
  username: z.string().trim().transform((value) => value.replace(/^@+/, "").toLowerCase()).pipe(z.string().min(3).max(30).regex(/^[a-z0-9_.]+$/)),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  let username = "unknown";
  try {
    const data = input.parse(await request.json()); username = data.username;
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, isActive: true } });
    if (!user?.isActive) {
      await audit({ userId: user?.id, action: "LOGIN_FAILED", entityType: "User", entityId: user?.id, newValues: { reason: "INVALID_OR_INACTIVE" } });
      return Response.json({ message: "Invalid username or password." }, { status: 401 });
    }
    const response = await auth.api.signInUsername({ body: data, headers: request.headers, asResponse: true });
    if (!response.ok) {
      await audit({ userId: user.id, action: "LOGIN_FAILED", entityType: "User", entityId: user.id, newValues: { reason: "INVALID_CREDENTIALS" } });
      return Response.json({ message: "Invalid username or password." }, { status: response.status });
    }
    await audit({ userId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id });
    return response;
  } catch {
    await audit({ action: "LOGIN_FAILED", entityType: "User", newValues: { username, reason: "INVALID_REQUEST" } }).catch(() => undefined);
    return Response.json({ message: "Invalid username or password." }, { status: 401 });
  }
}
