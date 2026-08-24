import { createHash, randomBytes } from "node:crypto";
import { sessionAbsoluteExpiresAt } from "@/lib/session-policy";

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function sessionTokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isUsableSessionRecord(expiresAt: Date, userIsActive: boolean, now = Date.now(), createdAt?: Date) {
  return userIsActive && expiresAt.getTime() > now && (!createdAt || sessionAbsoluteExpiresAt(createdAt).getTime() > now);
}
