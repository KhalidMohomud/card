import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";

type SessionUser = {
  id: string;
  fullName?: string;
  username?: string | null;
  role?: UserRole;
  isActive?: boolean;
};

function normalizeUser(user: SessionUser | undefined) {
  if (!user?.isActive || !user.fullName || (user.role !== "ADMIN" && user.role !== "SUPERVISOR")) return null;
  return { id: user.id, fullName: user.fullName, username: user.username ?? null, role: user.role, isActive: true as const };
}

export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return normalizeUser(session?.user as SessionUser | undefined);
});

export async function getFreshCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  return normalizeUser(session?.user as SessionUser | undefined);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: UserRole) {
  const user = await requireUser();
  if (user.role !== role) redirect(user.role === "SUPERVISOR" ? "/pos" : "/dashboard");
  return user;
}

export async function requireAdmin() {
  return requireRole("ADMIN");
}
