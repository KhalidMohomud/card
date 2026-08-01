export const LOGIN_WINDOW_MS = 60_000;
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_BLOCK_MS = 15 * 60_000;

type ExistingThrottle = {
  attempts: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

export function nextLoginThrottle(current: ExistingThrottle | null, now: Date) {
  const insideWindow = Boolean(current && current.windowStartedAt.getTime() > now.getTime() - LOGIN_WINDOW_MS);
  const attempts = insideWindow && current ? current.attempts + 1 : 1;
  const priorBlock = current?.blockedUntil && current.blockedUntil > now ? current.blockedUntil : null;
  const blockedUntil = attempts > LOGIN_MAX_ATTEMPTS ? new Date(now.getTime() + LOGIN_BLOCK_MS) : priorBlock;
  return { attempts, windowStartedAt: insideWindow && current ? current.windowStartedAt : now, blockedUntil };
}
