import { isIP } from "node:net";

const JSON_CONTENT_TYPE = /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i;
export const DEFAULT_MAX_JSON_BODY_BYTES = 16 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("REQUEST_BODY_TOO_LARGE");
    this.name = "RequestBodyTooLargeError";
  }
}

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

type ProxyEnvironment = { NODE_ENV?: string; VERCEL?: string; TRUST_PROXY_HEADERS?: string };

export function trustsProxyHeaders(env: ProxyEnvironment = process.env) {
  return env.NODE_ENV === "development" || env.VERCEL === "1" || env.TRUST_PROXY_HEADERS === "true";
}

export function clientIpFromHeaders(headers: Pick<Headers, "get">, trustProxy = trustsProxyHeaders()) {
  if (!trustProxy) return null;
  const forwarded = firstForwardedValue(headers.get("x-forwarded-for"));
  const real = headers.get("x-real-ip")?.trim() || null;
  const candidate = forwarded ?? real;
  return candidate && isIP(candidate) ? candidate : null;
}

export function isSameOriginMutation(request: Request, trustProxy = trustsProxyHeaders()) {
  const originHeader = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const forwardedHost = trustProxy ? firstForwardedValue(request.headers.get("x-forwarded-host")) : null;
  const forwardedProtocol = trustProxy ? firstForwardedValue(request.headers.get("x-forwarded-proto")) : null;
  const host = forwardedHost ?? request.headers.get("host")?.trim() ?? requestUrl.host;
  const protocol = forwardedProtocol ?? requestUrl.protocol.replace(/:$/, "");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

  if (!originHeader || !host || host.includes(",") || !["http", "https"].includes(protocol)) return false;
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

export async function readLimitedJson(request: Request, maxBytes = DEFAULT_MAX_JSON_BODY_BYTES): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) {
    throw new RequestBodyTooLargeError();
  }
  if (!request.body) throw new SyntaxError("Missing JSON body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
}
