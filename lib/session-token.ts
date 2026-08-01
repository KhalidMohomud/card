import { createHash, randomBytes } from "node:crypto";

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function sessionTokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isUsableSessionRecord(expiresAt: Date, userIsActive: boolean, now = Date.now()) {
  return userIsActive && expiresAt.getTime() > now;
}
