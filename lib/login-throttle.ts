import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LOGIN_BLOCK_MS, LOGIN_WINDOW_MS, nextLoginThrottle } from "@/lib/login-throttle-policy";

function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }

export function loginThrottleKeys(username: string, ipAddress: string) {
  return [`username:${digest(username)}`, `ip:${digest(ipAddress)}`];
}

export async function loginBlockSeconds(keys: string[]) {
  const now = new Date();
  const blocked = await prisma.loginThrottle.findFirst({ where: { key: { in: keys }, blockedUntil: { gt: now } }, orderBy: { blockedUntil: "desc" }, select: { blockedUntil: true } });
  return blocked?.blockedUntil ? Math.max(1, Math.ceil((blocked.blockedUntil.getTime() - now.getTime()) / 1000)) : 0;
}

export async function registerLoginAttempt(keys: string[]) {
  const now = new Date(); const expiresAt = new Date(now.getTime() + LOGIN_BLOCK_MS + LOGIN_WINDOW_MS);
  for (let retry = 0; retry < 3; retry += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        let blocked = false;
        for (const key of keys) {
          const current = await tx.loginThrottle.findUnique({ where: { key } });
          const { attempts, windowStartedAt, blockedUntil } = nextLoginThrottle(current, now);
          if (blockedUntil && blockedUntil > now) blocked = true;
          await tx.loginThrottle.upsert({ where: { key }, update: { attempts, windowStartedAt, blockedUntil, expiresAt }, create: { key, attempts, windowStartedAt, blockedUntil, expiresAt } });
        }
        return blocked;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && retry < 2)) throw error;
    }
  }
  throw new Error("LOGIN_THROTTLE_RETRY_EXHAUSTED");
}

export async function clearLoginFailures(keys: string[]) {
  await prisma.loginThrottle.deleteMany({ where: { key: { in: keys } } });
}
