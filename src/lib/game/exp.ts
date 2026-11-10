/**
 * EXP rules (SPEC §10, USER_FLOWS §3). Pure functions, run by the SERVER only
 * (CLAUDE.md: never trust the client for rewards). Every grant is an
 * exp_events row keyed by (kind, ref), so the same action never pays twice.
 */
import type { Outcome, Status } from "@/lib/tracker/status";
import { STATUSES } from "@/lib/tracker/status";
import { levelFor } from "./levels";
import { computeStreak, manilaWeekStart } from "./streak";

export const EXP = {
  profile: 50,
  viewMatch: 10,
  firstSave: 10,
  confirmFull: 20,
  confirmReduced: 5,
  status: 5,
  resultLogged: 10,
  resultOther: 5,
  checklist: 10,
  weeklyGoal: 30,
  resource: 15,
  coverLetter: 10,
} as const;

/** The first 3 confirmed applications a day earn the full amount (SPEC §10). */
export const CONFIRM_DAILY_FULL = 3;
/** All EXP a person can earn in one Manila day. */
export const DAILY_CAP = 300;
/** A "Yes, I applied" faster than this after the Apply click moves the card but earns nothing. */
export const CONFIRM_MIN_GAP_SECONDS = 60;
/** EXP needs the Apply click within this many days (USER_FLOWS §3). */
export const CONFIRM_EXP_WINDOW_DAYS = 7;
/** Weekly quest: confirm this many applications in a week (Monday to Sunday, Manila). */
export const WEEKLY_GOAL = 3;
export const WEEKLY_GOAL_TEXT = `Confirm ${WEEKLY_GOAL} applications`;
/** Days before streaks and the weekly quest unlock (SPEC §10 gradual unlock: "after week 1"). */
export const FIRST_WEEK_DAYS = 7;

export const EXP_KINDS = [
  "profile",
  "view_match",
  "first_save",
  "confirm",
  "status",
  "result",
  "checklist",
  "weekly_goal",
  "resource",
  "cover_letter",
] as const;

/** "I finished it" on a learning resource counts this long after opening it, and within 30 days. */
export const RESOURCE_MIN_MINUTES = 2;
export const RESOURCE_MAX_DAYS = 30;

/** Both times come from the server: the logged open (/learn/:id) and now. */
export function resourceEarnsExp(openedAt: Date | null, now: Date): { ok: true } | { ok: false; reason: "not-opened" | "too-fast" | "too-old" } {
  if (!openedAt) return { ok: false, reason: "not-opened" };
  const minutes = (now.getTime() - openedAt.getTime()) / 60_000;
  if (minutes < RESOURCE_MIN_MINUTES) return { ok: false, reason: "too-fast" };
  if (minutes > RESOURCE_MAX_DAYS * 24 * 60) return { ok: false, reason: "too-old" };
  return { ok: true };
}
export type ExpKind = (typeof EXP_KINDS)[number];

export type ExpEvent = { kind: ExpKind; ref: string; amount: number; created_at: string };

/* ------------------------------------------------------------------------ */
/* Single actions                                                            */
/* ------------------------------------------------------------------------ */

export function confirmExp(confirmsEarlierToday: number): number {
  return confirmsEarlierToday < CONFIRM_DAILY_FULL ? EXP.confirmFull : EXP.confirmReduced;
}

export type ConfirmCheck = { ok: true } | { ok: false; reason: "no-click" | "too-fast" | "too-old" };

/**
 * Does a confirmation earn EXP? Both times come from the server (click log
 * and now), so the browser can't fake either.
 */
export function confirmEarnsExp(lastClickAt: Date | null, confirmAt: Date): ConfirmCheck {
  if (!lastClickAt) return { ok: false, reason: "no-click" };
  const gap = (confirmAt.getTime() - lastClickAt.getTime()) / 1000;
  if (gap < CONFIRM_MIN_GAP_SECONDS) return { ok: false, reason: "too-fast" };
  if (gap > CONFIRM_EXP_WINDOW_DAYS * 86_400) return { ok: false, reason: "too-old" };
  return { ok: true };
}

const rank = (s: Status) => STATUSES.indexOf(s);

/**
 * A quest log move: +5 for a forward step, +10 for logging an offer or a
 * rejection (+5 for other results). Only confirmed applications from
 * InternQuest listings earn; never backwards; each step once (the ref).
 */
export function moveExp(m: {
  entryId: string;
  confirmed: boolean;
  fromListing: boolean;
  from: Status;
  to: Status;
  outcome: Outcome | null;
}): { kind: "status" | "result"; ref: string; amount: number } | null {
  if (!m.confirmed || !m.fromListing) return null;
  if (m.to === "saved" || rank(m.to) <= rank(m.from)) return null;
  if (m.to === "result") {
    const logged = m.outcome === "offer" || m.outcome === "not_selected";
    return { kind: "result", ref: m.entryId, amount: logged ? EXP.resultLogged : EXP.resultOther };
  }
  return { kind: "status", ref: `${m.entryId}:${m.to}`, amount: EXP.status };
}

/** What's left under the daily cap. */
export function capToDaily(amount: number, earnedToday: number): number {
  return Math.max(0, Math.min(amount, DAILY_CAP - earnedToday));
}

/* ------------------------------------------------------------------------ */
/* Badges (effort only, never results: decision #71)                         */
/* ------------------------------------------------------------------------ */

export type BadgeStats = {
  confirmed: number;
  resultsLogged: number;
  listingsSaved: number;
  streakWeeks: number;
  checklists: string[];
  /** Skills with a finished learning resource. */
  resourcesFinished: number;
};

export function earnedBadges(s: BadgeStats): string[] {
  const out: string[] = [];
  if (s.confirmed >= 1) out.push("first-quest");
  if (s.checklists.includes("interview")) out.push("prepared");
  if (s.resultsLogged >= 1) out.push("follow-through");
  if (s.resourcesFinished >= 1) out.push("skill-up");
  if (s.streakWeeks >= 4) out.push("on-a-roll");
  if (s.listingsSaved >= 5) out.push("scout");
  return out;
}

/* ------------------------------------------------------------------------ */
/* Progress summary for the screens                                          */
/* ------------------------------------------------------------------------ */

export type Progress = {
  totalExp: number;
  level: number;
  exp: number;
  expMax: number;
  weekExp: number;
  streakWeeks: number;
  restWeekAvailable: boolean;
  /** First week: the tutorial shows instead of streaks and the weekly quest. */
  isNew: boolean;
  tutorial: { profile: boolean; viewedMatch: boolean; saved: boolean };
  weeklyQuest: { goal: string; done: number; total: number } | null;
};

/** What the screen shows after an action: the server's numbers, nothing computed in the browser. */
export type ServerReward = {
  amount: number;
  leveledUp: boolean;
  newBadges: string[];
  progress: Progress;
  badges: string[];
};

export function manilaDayOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

export function earnedToday(events: ExpEvent[], now: Date): number {
  const today = manilaDayOf(now.toISOString());
  return events.filter((e) => manilaDayOf(e.created_at) === today).reduce((sum, e) => sum + e.amount, 0);
}

export function progressFrom(
  events: ExpEvent[],
  opts: { joinedAt: string; now: Date; confirmedThisWeek: number },
): Progress {
  const totalExp = events.reduce((sum, e) => sum + e.amount, 0);
  const week = manilaWeekStart(opts.now);
  const weekExp = events.filter((e) => manilaWeekStart(new Date(e.created_at)) === week).reduce((s, e) => s + e.amount, 0);
  const streak = computeStreak(
    events.filter((e) => e.amount > 0).map((e) => manilaWeekStart(new Date(e.created_at))),
    week,
  );
  const isNew = opts.now.getTime() - new Date(opts.joinedAt).getTime() < FIRST_WEEK_DAYS * 86_400_000;
  const has = (kind: ExpKind) => events.some((e) => e.kind === kind);
  return {
    totalExp,
    ...levelFor(totalExp),
    weekExp,
    streakWeeks: isNew ? 0 : streak.weeks,
    restWeekAvailable: streak.restWeekAvailable,
    isNew,
    tutorial: { profile: has("profile"), viewedMatch: has("view_match"), saved: has("first_save") },
    weeklyQuest: isNew ? null : { goal: WEEKLY_GOAL_TEXT, done: Math.min(opts.confirmedThisWeek, WEEKLY_GOAL), total: WEEKLY_GOAL },
  };
}
