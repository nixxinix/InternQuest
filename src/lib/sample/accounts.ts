/**
 * SAMPLE username availability for the design preview (no Supabase connected).
 * With Supabase connected, the server checks the real profiles table instead,
 * and the unique index on profiles.username is the final guard.
 */
import { RESERVED_USERNAMES } from "@/lib/auth/validation";

const TAKEN = new Set(["mika.codes", "juan", "maria", "kape.coder", "jun.builds"]);

export function isUsernameTaken(username: string): boolean {
  const u = username.toLowerCase();
  return TAKEN.has(u) || RESERVED_USERNAMES.has(u);
}
