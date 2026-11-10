import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * The company email-confirmation link's token. Unlike a password or a short
 * recovery code, this is long and random (128 bits), so a plain SHA-256
 * hash is enough — brute-forcing it isn't feasible either way. It's looked
 * up by an indexed equality match in the database, so no in-process
 * timing-safe compare is needed on top.
 */
export function makeConfirmToken(): string {
  return randomBytes(16).toString("base64url");
}

export function hashConfirmToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
