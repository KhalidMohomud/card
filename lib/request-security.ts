const JSON_CONTENT_TYPE = /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i;

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function isSameOriginMutation(request: Request) {
  const originHeader = request.headers.get("origin");
  const host = firstForwardedValue(request.headers.get("x-forwarded-host"))
    ?? request.headers.get("host")?.trim()
    ?? null;
  const protocol = firstForwardedValue(request.headers.get("x-forwarded-proto"))
    ?? new URL(request.url).protocol.replace(/:$/, "");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

  if (!originHeader || !host || !["http", "https"].includes(protocol)) return false;
  if (fetchSite && fetchSite !== "same-origin") return false;

  try {
    const origin = new URL(originHeader);
    return origin.origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

export function hasJsonContentType(request: Request) {
  return JSON_CONTENT_TYPE.test(request.headers.get("content-type") ?? "");
}
