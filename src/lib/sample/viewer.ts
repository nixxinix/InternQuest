/**
 * SAMPLE logged-in user for designing the app screens before accounts exist.
 * Phase 1 replaces this with the session user's profile, and Phase 3 with
 * the real EXP, level, streak, and weekly quest rows from the server.
 * Level and EXP numbers here are placeholders; the level curve is set in Phase 3.
 */
import type { FieldId } from "@/lib/catalog/fields";
import type { WorkType } from "@/lib/listings/types";
import { addDays, interviewText, manilaDate } from "@/lib/tracker/log";

export type Viewer = {
  username: string;
  look: { skin: string; hair: string };
  level: number;
  exp: number;
  expMax: number;
  streakWeeks: number;
  restWeekAvailable: boolean;
  field: FieldId;
  skills: string[];
  cityId: string | null;
  workType: WorkType | null;
  /** Optional profile status and school (SPEC §5.1, decision M8). */
  status: string | null;
  school: string | null;
  /** Confirmed applications, all time (share card, leaderboard). */
  applicationsTotal: number;
  /** EXP earned all time. `exp` is progress inside the current level. */
  totalExp: number;
  /** Earned badge ids (see lib/game/badges). */
  badges: string[];
  /** How a forgotten password can be reset. Never the codes themselves. */
  recovery: { kind: "codes"; codesLeft: number } | { kind: "email"; email: string } | { kind: "none" };
  /** First week only: the tutorial checklist replaces the weekly quest. */
  isNew: boolean;
  tutorial: { profile: boolean; viewedMatch: boolean; saved: boolean; applied: boolean };
  weeklyQuest: { goal: string; done: number; total: number } | null;
  /** Listing ids in the quest log, by status. */
  saved: string[];
  applied: string[];
  /** Apply clicked but not confirmed (USER_FLOWS §3). */
  pendingConfirm: string | null;
  upcoming: { listingId: string; company?: string; what: string; when: string; how: string }[];
};

export const SAMPLE_VIEWER: Viewer = {
  username: "mika.codes",
  look: { skin: "#c98f62", hair: "#1b1410" },
  level: 4,
  exp: 480,
  expMax: 500,
  streakWeeks: 3,
  restWeekAvailable: true,
  field: "iot",
  skills: ["c", "arduino", "sensors", "python"],
  cityId: "quezon-city",
  workType: "hybrid",
  status: "student",
  school: "tip-qc",
  applicationsTotal: 12,
  totalExp: 1980,
  badges: ["first-quest", "prepared", "follow-through"],
  recovery: { kind: "codes", codesLeft: 8 },
  isNew: false,
  tutorial: { profile: true, viewedMatch: true, saved: true, applied: true },
  weeklyQuest: { goal: "Send 4 applications", done: 3, total: 4 },
  saved: ["kanto-social-media", "kalye-data-analyst", "sari-ux-design"],
  applied: ["bayanihan-qa"],
  pendingConfirm: "tanglaw-iot-firmware",
  // Same interview as the sample quest log: 3 days from today, 10:00 AM Manila time.
  upcoming: [
    {
      listingId: "ilaw-embedded",
      what: "Interview",
      when: interviewText(`${addDays(manilaDate(new Date()), 3)}T10:00`),
      how: "Online (Google Meet)",
    },
  ],
};

export const SAMPLE_NEW_VIEWER: Viewer = {
  ...SAMPLE_VIEWER,
  username: "ana.reyes",
  level: 1,
  exp: 50,
  expMax: 100,
  streakWeeks: 0,
  restWeekAvailable: false,
  skills: ["c", "arduino"],
  status: null,
  school: null,
  applicationsTotal: 0,
  totalExp: 50,
  badges: [],
  recovery: { kind: "none" },
  isNew: true,
  tutorial: { profile: true, viewedMatch: false, saved: false, applied: false },
  weeklyQuest: null,
  saved: [],
  applied: [],
  pendingConfirm: null,
  upcoming: [],
};
