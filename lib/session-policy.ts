export const SESSION_IDLE_TTL_SECONDS = 15 * 60;
export const SESSION_ABSOLUTE_TTL_SECONDS = 8 * 60 * 60;
export const SESSION_RENEWAL_WINDOW_SECONDS = 5 * 60;
export const SESSION_RECENT_ACTIVITY_SECONDS = 60;

export function sessionAbsoluteExpiresAt(createdAt: Date) {
  return new Date(createdAt.getTime() + SESSION_ABSOLUTE_TTL_SECONDS * 1_000);
}

export function nextSessionExpiresAt(createdAt: Date, now = Date.now()) {
  const idleExpiry = now + SESSION_IDLE_TTL_SECONDS * 1_000;
  return new Date(Math.min(idleExpiry, sessionAbsoluteExpiresAt(createdAt).getTime()));
}

export function shouldRenewSession(expiresAt: Date, now = Date.now()) {
  const remaining = expiresAt.getTime() - now;
  return remaining > 0 && remaining <= SESSION_RENEWAL_WINDOW_SECONDS * 1_000;
}
