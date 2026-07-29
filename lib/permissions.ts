import type { UserRole } from "@prisma/client";

export type Permission =
  | "receipt:create"
  | "receipt:view-all"
  | "receipt:cancel"
  | "receipt:reprint"
  | "service:manage"
  | "user:manage"
  | "expense:manage"
  | "inventory:manage"
  | "report:view"
  | "settings:manage"
  | "audit:view";

const permissions: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    "receipt:create", "receipt:view-all", "receipt:cancel", "receipt:reprint",
    "service:manage", "user:manage", "expense:manage", "inventory:manage",
    "report:view", "settings:manage", "audit:view",
  ]),
  SUPERVISOR: new Set<Permission>(["receipt:create", "receipt:reprint"]),
};

export function can(role: UserRole, permission: Permission) {
  return permissions[role].has(permission);
}

export function assertPermission(role: UserRole, permission: Permission) {
  if (!can(role, permission)) throw new Error("FORBIDDEN");
}
