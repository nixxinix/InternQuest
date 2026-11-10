/**
 * Username and password rules. Pure functions, used by the form for instant
 * feedback AND (Phase 1) by the server, which must re-check everything.
 *
 * Passwords follow NIST SP 800-63B: a minimum length, a block list of very
 * common passwords, and no forced mix of symbols or digits. Long and memorable
 * beats short and complex.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** Same list as the `username_not_reserved` check in supabase/migrations/0001_core.sql. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "internquest",
  "support",
  "moderator",
  "help",
  "root",
  "system",
]);

export type UsernameCheck = { ok: true; value: string } | { ok: false; value: string; error: string };

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): UsernameCheck {
  const value = normalizeUsername(raw);
  const fail = (error: string): UsernameCheck => ({ ok: false, value, error });
  if (!value) return fail("Pick a username.");
  if (value.length < USERNAME_MIN) return fail(`Use at least ${USERNAME_MIN} characters.`);
  if (value.length > USERNAME_MAX) return fail(`Keep it to ${USERNAME_MAX} characters or fewer.`);
  if (!/^[a-z0-9._]+$/.test(value)) return fail("Use only letters, numbers, dots, and underscores.");
  if (!/^[a-z]/.test(value)) return fail("Start with a letter.");
  if (/[._]$/.test(value)) return fail("End with a letter or number.");
  if (/[._]{2}/.test(value)) return fail("Don't put two dots or underscores in a row.");
  if (RESERVED_USERNAMES.has(value)) return fail("That name is reserved. Try another one.");
  return { ok: true, value };
}

/**
 * Small block list, checked in the form and again on the server. A larger
 * breached-password check (Supabase's leaked-password protection) needs a paid plan.
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd123",
  "1234567890",
  "12345678910",
  "0123456789",
  "qwertyuiop",
  "qwerty1234",
  "qwerty12345",
  "1q2w3e4r5t",
  "iloveyou12",
  "iloveyou123",
  "abcdefghij",
  "philippines",
  "manila12345",
  "internquest",
  // The example shown in the password hint, so nobody copies it.
  "tita loves mango shakes",
]);

export type PasswordStrength = "too-short" | "okay" | "strong";
export type PasswordCheck = { ok: boolean; strength: PasswordStrength; error?: string };

export function validatePassword(password: string, username = ""): PasswordCheck {
  const lower = password.toLowerCase();
  const user = normalizeUsername(username);
  if (password.length < PASSWORD_MIN) {
    const left = PASSWORD_MIN - password.length;
    return {
      ok: false,
      strength: "too-short",
      error: `Use at least ${PASSWORD_MIN} characters. ${left} more to go.`,
    };
  }
  if (password.length > PASSWORD_MAX) {
    return { ok: false, strength: "okay", error: `Keep it under ${PASSWORD_MAX} characters.` };
  }
  if (COMMON_PASSWORDS.has(lower)) {
    return {
      ok: false,
      strength: "okay",
      error: "That one is on every hacker's list. Try a short sentence instead.",
    };
  }
  if (user.length >= USERNAME_MIN && lower.includes(user)) {
    return { ok: false, strength: "okay", error: "Leave your username out of your password." };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, strength: "okay", error: "Use more than one repeated character." };
  }
  const strong = password.length >= 16 || (password.length >= 12 && /\s/.test(password));
  return { ok: true, strength: strong ? "strong" : "okay" };
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Free alternatives when a username is taken, e.g. mika.codes -> mika.codes2. */
export function suggestUsernames(base: string, isTaken: (u: string) => boolean, count = 3): string[] {
  const root = normalizeUsername(base).slice(0, USERNAME_MAX - 3).replace(/[._]+$/, "");
  const out: string[] = [];
  const candidates = [...Array.from({ length: 8 }, (_, i) => `${root}${i + 2}`), `${root}_ph`, `${root}.ojt`];
  for (const c of candidates) {
    if (out.length >= count) break;
    if (validateUsername(c).ok && !isTaken(c)) out.push(c);
  }
  return out;
}
