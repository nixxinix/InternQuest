/**
 * SAMPLE username availability. Phase 1 replaces this with a rate-limited
 * server check (and the unique index on profiles.username is the real guard).
 */

const TAKEN = new Set(["mika.codes", "juan", "maria", "kape.coder", "jun.builds"]);
const RESERVED = new Set(["admin", "administrator", "internquest", "support", "moderator", "help", "root", "system"]);

export function isUsernameTaken(username: string): boolean {
  const u = username.toLowerCase();
  return TAKEN.has(u) || RESERVED.has(u);
}
