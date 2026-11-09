/**
 * One-time recovery codes (decision M3), for people who skip the recovery email.
 *
 * Phase 1: codes are generated on the SERVER, shown once, and only their
 * hashes are stored (like passwords). Each code works once. This module is
 * the shared format plus a generator that takes its randomness as a
 * parameter, so it can be tested.
 */

/** No 0/O, 1/I/L: easy to read aloud and type from paper. */
export const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 8;

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
  const values = random(count * 8);
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let s = "";
    for (let j = 0; j < 8; j++) s += RECOVERY_ALPHABET[values[i * 8 + j] % RECOVERY_ALPHABET.length];
    codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return codes;
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
