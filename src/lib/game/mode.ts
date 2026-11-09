/**
 * Game modes and the words each mode uses (USER_FLOWS.md section 9).
 * Pure data and functions only, so it can be unit tested and used on the
 * server. All user-facing game vocabulary lives here (decision M6: one
 * place for strings, ready for Filipino/Taglish later).
 */

export const GAME_MODES = ["full", "light", "plain"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const DEFAULT_MODE: GameMode = "full";

export function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && (GAME_MODES as readonly string[]).includes(value);
}

export const MODE_LABELS: Record<GameMode, { name: string; summary: string }> = {
  full: {
    name: "Full Quest",
    summary: "Avatar, EXP, levels, streaks, badges, and weekly quests.",
  },
  light: {
    name: "Light",
    summary: "Just an EXP bar and badges. Small toasts, no big screens.",
  },
  plain: {
    name: "Plain",
    summary: "A clean tracker and listings. No game parts at all.",
  },
};

export type VocabKey =
  | "listing"
  | "listings"
  | "tracker"
  | "skills"
  | "missingSkills"
  | "profile"
  | "homeMatches";

const VOCAB: Record<VocabKey, Record<GameMode, string>> = {
  listing: { full: "Quest", light: "Listing", plain: "Listing" },
  listings: { full: "Quests", light: "Listings", plain: "Listings" },
  tracker: { full: "Quest log", light: "Quest log", plain: "Applications" },
  skills: { full: "Abilities", light: "Skills", plain: "Skills" },
  missingSkills: { full: "Missing abilities", light: "Missing skills", plain: "Missing skills" },
  profile: { full: "Character", light: "Profile", plain: "Profile" },
  homeMatches: { full: "Quests for you", light: "Top matches", plain: "Top matches" },
};

export function vocab(mode: GameMode, key: VocabKey): string {
  return VOCAB[key][mode];
}

/** Which game features a mode shows. Unlock rules (levels) are applied on top in Phase 3. */
export function modeFeatures(mode: GameMode) {
  return {
    exp: mode !== "plain",
    badges: mode !== "plain",
    avatar: mode === "full",
    streak: mode === "full",
    weeklyQuest: mode === "full",
    levelUpScreen: mode === "full",
    leaderboard: mode === "full",
    motivationalNotes: mode === "full",
    expCountUp: mode === "full",
  } as const;
}
