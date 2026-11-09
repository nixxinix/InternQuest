/**
 * Hashing for secrets we must check later but never read back.
 * Server code only (uses node:crypto); kept free of "server-only" so tests can import it.
 *
 * - Recovery codes: scrypt, a slow, memory-hard hash with a random salt per
 *   code, like a password. A stolen database doesn't reveal the codes.
 * - Network addresses for rate limits: HMAC with a server secret, so the
 *   stored value can't be turned back into an IP by trying every address.
 */
import { createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { normalizeRecoveryCode } from "./recovery";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 } as const;

function scryptAsync(secret: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(secret, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Format: scrypt$N$r$p$salt$hash (base64). The parameters travel with the hash so they can be raised later. */
export async function hashRecoveryCode(code: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(normalizeRecoveryCode(code), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyRecoveryCode(code: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((x) => Number.isInteger(x) && x > 0) || N > 2 ** 20) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await scryptAsync(normalizeRecoveryCode(code), salt, expected.length, { N, r, p, maxmem: 256 * N * r });
  return timingSafeEqual(actual, expected);
}

/** Short, stable, one-way label for a network address, for rate-limit buckets only. */
export function networkKey(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip.trim().toLowerCase()).digest("base64url").slice(0, 22);
}
