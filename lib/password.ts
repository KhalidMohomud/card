import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_OPTIONS = { N: 16_384, r: 16, p: 1, maxmem: 128 * 16_384 * 16 * 2 } as const;
const KEY_LENGTH = 64;
const HASH_PATTERN = /^[a-f0-9]{32}:[a-f0-9]{128}$/;

function deriveKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(hash: string, password: string) {
  if (!HASH_PATTERN.test(hash)) return false;
  const [salt, encodedKey] = hash.split(":");
  const target = Buffer.from(encodedKey, "hex");
  const actual = await deriveKey(password, salt);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export function isPasswordHash(value: string) {
  return HASH_PATTERN.test(value);
}
