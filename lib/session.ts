import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { readDatabaseSession } from "@/lib/auth-session";

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  username: string | null;
  role: UserRole;
  isActive: true;
  sessionExpiresAt: string;
};

async function readCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await readDatabaseSession();
  if (!session) return null;
  return { id: session.user.id, fullName: session.user.fullName, username: session.user.username, role: session.user.role, isActive: true, sessionExpiresAt: session.expiresAt.toISOString() };
}

export const getCurrentUser = cache(readCurrentUser);
export async function getFreshCurrentUser() { return readCurrentUser(); }

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?expired=1");
  return user;
}

export async function requireRole(role: UserRole) {
  const user = await requireUser();
  if (user.role !== role) redirect(user.role === "SUPERVISOR" ? "/pos" : "/dashboard");
  return user;
}

export async function requireManagement() {
  const user = await requireUser();
  if (user.role === "SUPERVISOR") redirect("/pos");
  return user;
}

export async function requireAdmin() { return requireRole("ADMIN"); }
