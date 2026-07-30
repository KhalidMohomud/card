import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60_000;

function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }

export function loginThrottleKeys(username: string, ipAddress: string) {
  return [`username:${digest(username)}`, `ip:${digest(ipAddress)}`];
}

export async function loginBlockSeconds(keys: string[]) {
  const now = new Date();
  const blocked = await prisma.loginThrottle.findFirst({ where: { key: { in: keys }, blockedUntil: { gt: now } }, orderBy: { blockedUntil: "desc" }, select: { blockedUntil: true } });
  return blocked?.blockedUntil ? Math.max(1, Math.ceil((blocked.blockedUntil.getTime() - now.getTime()) / 1000)) : 0;
}

export async function registerLoginFailure(keys: string[]) {
  const now = new Date(); const windowStartedAt = new Date(now.getTime()); const expiresAt = new Date(now.getTime() + BLOCK_MS + WINDOW_MS);
  return prisma.$transaction(async (tx) => {
    let blocked = false;
    for (const key of keys) {
      const current = await tx.loginThrottle.findUnique({ where: { key } });
      const insideWindow = current && current.windowStartedAt.getTime() > now.getTime() - WINDOW_MS;
      const attempts = insideWindow ? current.attempts + 1 : 1;
      const blockedUntil = attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + BLOCK_MS) : current?.blockedUntil && current.blockedUntil > now ? current.blockedUntil : null;
      if (blockedUntil && blockedUntil > now) blocked = true;
      await tx.loginThrottle.upsert({ where: { key }, update: { attempts, windowStartedAt: insideWindow ? current.windowStartedAt : windowStartedAt, blockedUntil, expiresAt }, create: { key, attempts, windowStartedAt, blockedUntil, expiresAt } });
    }
    return blocked;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function clearLoginFailures(keys: string[]) {
  await prisma.loginThrottle.deleteMany({ where: { key: { in: keys } } });
}
