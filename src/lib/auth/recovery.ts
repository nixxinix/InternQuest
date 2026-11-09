/**
 * One-time recovery codes (decision M3), for people who forget their password.
 *
 * The browser makes the 8 codes with crypto.getRandomValues (about 40 bits
 * each), shows them once, and sends them to the server, which checks the
 * format and stores only slow hashes (src/lib/auth/secrets.ts). Making them in
 * the browser means the codes saved are exactly the codes shown, even if a
 * request is retried. Each code works once.
 */

/** No 0/O, 1/I/L: easy to read aloud and type from paper. */
export const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 8;
const CODE_LENGTH = 8;

function cryptoRandom(n: number): Uint32Array {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return a;
}

/** Codes look like "K7QM-3XRP". Modulo bias over 2^32 values is negligible for 31 symbols. */
export function generateRecoveryCodes(
  count = RECOVERY_CODE_COUNT,
  random: (n: number) => Uint32Array = cryptoRandom,
): string[] {
  const values = random(count * CODE_LENGTH);
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let s = "";
    for (let j = 0; j < CODE_LENGTH; j++) s += RECOVERY_ALPHABET[values[i * CODE_LENGTH + j] % RECOVERY_ALPHABET.length];
    codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return codes;
}

/**
 * What gets hashed and compared: uppercase, no dash or spaces. People type
 * codes from paper, so "k7qm 3xrp" and "K7QM-3XRP" are the same code.
 */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isRecoveryCode(input: string): boolean {
  const n = normalizeRecoveryCode(input);
  return n.length === CODE_LENGTH && [...n].every((c) => RECOVERY_ALPHABET.includes(c));
}

/** The server accepts a new set only if it is exactly 8 distinct, well-formed codes. */
export function isValidCodeSet(codes: unknown): codes is string[] {
  if (!Array.isArray(codes) || codes.length !== RECOVERY_CODE_COUNT) return false;
  if (!codes.every((c) => typeof c === "string" && isRecoveryCode(c))) return false;
  return new Set(codes.map(normalizeRecoveryCode)).size === codes.length;
}

export function recoveryFileText(username: string, codes: string[], date: Date): string {
  return [
    `InternQuest recovery codes for ${username}`,
    `Made on ${date.toISOString().slice(0, 10)}`,
    "",
    "Use one of these if you forget your password. Each code works once.",
    "Keep this file somewhere safe and private.",
    "",
    ...codes.map((c, i) => `${i + 1}. ${c}`),
    "",
  ].join("\n");
}
