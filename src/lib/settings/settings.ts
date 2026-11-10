/**
 * User settings (SPEC §10) and the account actions that are pure logic:
 * "Download my data" (decision M7) and the delete confirmation.
 * Phase 3 stores settings in `user_settings`; Phase 1 serves the export from
 * the server so it includes everything the database holds.
 */
import { normalizeUsername } from "@/lib/auth/validation";
import type { GameMode } from "@/lib/game/mode";

export const NOTE_TONES = ["cheerful", "calm", "off"] as const;
export type NoteTone = (typeof NOTE_TONES)[number];
export const NOTE_TONE_LABEL: Record<NoteTone, string> = { cheerful: "Cheerful", calm: "Calm", off: "Off" };

export type UserSettings = {
  mode: GameMode;
  streaks: boolean;
  leaderboard: boolean;
  /** Separate from `leaderboard` (SPEC §10): you can look without being listed. */
  showOnLeaderboard: boolean;
  notes: NoteTone;
  /** Off = same as the OS "reduce motion" setting. */
  animations: boolean;
  /** Off by default (SPEC §10). */
  sound: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  mode: "full",
  streaks: true,
  leaderboard: true,
  showOnLeaderboard: true,
  notes: "cheerful",
  animations: true,
  sound: false,
};

/** Delete needs the username typed exactly (case and spaces forgiven). */
export function canConfirmDelete(typed: string, username: string): boolean {
  return normalizeUsername(typed) !== "" && normalizeUsername(typed) === normalizeUsername(username);
}

/** "mika@gmail.com" -> "m•••@gmail.com". Settings can be on a shared screen, so the address isn't shown in full. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}

export const EXPORT_VERSION = 1;

export type ExportInput = {
  account: { username: string; recovery: "codes" | "email" | "none"; recoveryEmail?: string | null };
  profile: Record<string, unknown>;
  progress: Record<string, unknown>;
  settings: UserSettings;
  questLog: Record<string, unknown>[];
  /** Other records kept about the user (checklists, AI helper uses, ...). */
  more?: Record<string, unknown>;
};

/**
 * Everything we hold about the user, in one readable JSON file (Data Privacy
 * Act right to access). Never includes the password, its hash, or recovery
 * code hashes: those can't be read back by anyone, and aren't "your data" in
 * a useful form.
 */
export function buildDataExport(input: ExportInput, exportedAt: Date) {
  return {
    about: "Your InternQuest data. Passwords and recovery codes are never included.",
    version: EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    account: {
      username: input.account.username,
      recoveryMethod: input.account.recovery,
      ...(input.account.recovery === "email" && input.account.recoveryEmail ? { recoveryEmail: input.account.recoveryEmail } : {}),
    },
    profile: input.profile,
    progress: input.progress,
    settings: input.settings,
    ...(input.more ?? {}),
    questLog: input.questLog,
  };
}
