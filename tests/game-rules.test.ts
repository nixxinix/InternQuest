import { describe, expect, it } from "vitest";
import {
  CONFIRM_DAILY_FULL,
  DAILY_CAP,
  EXP,
  WEEKLY_GOAL,
  capToDaily,
  confirmEarnsExp,
  confirmExp,
  earnedBadges,
  earnedToday,
  moveExp,
  progressFrom,
  type ExpEvent,
} from "@/lib/game/exp";
import { expToNext, levelFor, levelStart } from "@/lib/game/levels";
import { computeStreak, manilaWeekStart, weekStartInstant } from "@/lib/game/streak";

const at = (iso: string) => new Date(iso);
const ev = (kind: ExpEvent["kind"], amount: number, created_at: string, ref = created_at): ExpEvent => ({ kind, amount, created_at, ref });

describe("level curve", () => {
  it("reaches Level 2 with the tutorial alone (profile +50, view +10, save +10)", () => {
    expect(EXP.profile + EXP.viewMatch + EXP.firstSave).toBe(70);
    expect(levelFor(69)).toEqual({ level: 1, exp: 69, expMax: 70 });
    expect(levelFor(70)).toEqual({ level: 2, exp: 0, expMax: 150 });
  });

  it("asks 50 more EXP for each level after that; Level 3 (leaderboard) at 220", () => {
    expect([2, 3, 4, 5].map(expToNext)).toEqual([150, 250, 350, 450]);
    expect(levelStart(3)).toBe(220);
    expect(levelStart(4)).toBe(470);
    expect(levelFor(469)).toMatchObject({ level: 3, exp: 249 });
    expect(levelFor(-5)).toEqual({ level: 1, exp: 0, expMax: 70 });
  });
});

describe("weekly streaks (Manila weeks, Monday start)", () => {
  it("finds the Monday of a Manila week, even late Sunday UTC", () => {
    // Sunday Nov 15, 2026, 17:00 UTC = Monday Nov 16, 01:00 in Manila.
    expect(manilaWeekStart(at("2026-11-15T17:00:00Z"))).toBe("2026-11-16");
    expect(manilaWeekStart(at("2026-11-15T15:00:00Z"))).toBe("2026-11-09");
    expect(weekStartInstant("2026-11-09")).toBe("2026-11-08T16:00:00.000Z");
  });

  it("counts consecutive active weeks; this week can still be empty", () => {
    expect(computeStreak(["2026-11-09", "2026-11-02", "2026-10-26"], "2026-11-09").weeks).toBe(3);
    expect(computeStreak(["2026-11-02", "2026-10-26"], "2026-11-09").weeks).toBe(2);
    expect(computeStreak([], "2026-11-09").weeks).toBe(0);
  });

  it("forgives one missed week a month (a rest week), not two", () => {
    // Active Nov 9, Oct 26, Oct 19; Nov 2 missed (rest week, November).
    const s = computeStreak(["2026-11-09", "2026-10-26", "2026-10-19"], "2026-11-09");
    expect(s).toEqual({ weeks: 3, restWeekAvailable: false });
    // Two missed weeks in a row: the streak stops at the gap.
    expect(computeStreak(["2026-11-09", "2026-10-19"], "2026-11-09").weeks).toBe(1);
    // A second missed week in the same month isn't forgiven.
    expect(computeStreak(["2026-11-30", "2026-11-16", "2026-11-02"], "2026-11-30").weeks).toBe(2);
  });

  it("has this month's rest week available until it's used", () => {
    expect(computeStreak(["2026-11-09", "2026-11-02"], "2026-11-09").restWeekAvailable).toBe(true);
  });
});

describe("EXP rules (server side)", () => {
  it("pays +20 for the first 3 confirmations a day, then +5", () => {
    expect([0, 1, 2, 3, 9].map(confirmExp)).toEqual([20, 20, 20, 5, 5]);
    expect(CONFIRM_DAILY_FULL).toBe(3);
  });

  it("needs an Apply click 60 seconds to 7 days before the confirmation", () => {
    const now = at("2026-11-10T04:00:00Z");
    expect(confirmEarnsExp(null, now)).toEqual({ ok: false, reason: "no-click" });
    expect(confirmEarnsExp(at("2026-11-10T03:59:30Z"), now)).toEqual({ ok: false, reason: "too-fast" });
    expect(confirmEarnsExp(at("2026-11-10T03:58:00Z"), now)).toEqual({ ok: true });
    expect(confirmEarnsExp(at("2026-11-02T03:00:00Z"), now)).toEqual({ ok: false, reason: "too-old" });
  });

  it("pays for forward moves of confirmed listing applications only, each step once", () => {
    const base = { entryId: "e1", confirmed: true, fromListing: true, from: "applied" as const, outcome: null };
    expect(moveExp({ ...base, to: "interview" })).toEqual({ kind: "status", ref: "e1:interview", amount: 5 });
    expect(moveExp({ ...base, to: "result", outcome: "offer" })).toEqual({ kind: "result", ref: "e1", amount: 10 });
    expect(moveExp({ ...base, to: "result", outcome: "not_selected" })?.amount).toBe(10);
    expect(moveExp({ ...base, to: "result", outcome: "no_reply" })?.amount).toBe(5);
    expect(moveExp({ ...base, to: "saved" })).toBeNull(); // backwards
    expect(moveExp({ ...base, from: "interview", to: "applied" })).toBeNull();
    expect(moveExp({ ...base, confirmed: false, to: "interview" })).toBeNull(); // not confirmed
    expect(moveExp({ ...base, fromListing: false, to: "interview" })).toBeNull(); // added by hand
  });

  it("caps everything at 300 EXP a Manila day", () => {
    expect(capToDaily(20, 0)).toBe(20);
    expect(capToDaily(20, DAILY_CAP - 5)).toBe(5);
    expect(capToDaily(20, DAILY_CAP)).toBe(0);
    const now = at("2026-11-10T04:00:00Z");
    const events = [ev("confirm", 20, "2026-11-10T01:00:00Z"), ev("confirm", 20, "2026-11-09T16:30:00Z"), ev("confirm", 20, "2026-11-09T15:00:00Z")];
    // Manila midnight is 16:00 UTC: 16:30Z on Nov 9 is already Nov 10 there; 15:00Z is still Nov 9 (11 PM).
    expect(earnedToday(events, now)).toBe(40);
  });
});

describe("badges reward effort, never results", () => {
  it("earns each badge from its own effort", () => {
    expect(earnedBadges({ confirmed: 0, resultsLogged: 0, listingsSaved: 0, streakWeeks: 0, checklists: [], resourcesFinished: 0 })).toEqual([]);
    expect(earnedBadges({ confirmed: 1, resultsLogged: 1, listingsSaved: 5, streakWeeks: 4, checklists: ["interview"], resourcesFinished: 1 })).toEqual([
      "first-quest",
      "prepared",
      "follow-through",
      "skill-up",
      "on-a-roll",
      "scout",
    ]);
    expect(earnedBadges({ confirmed: 0, resultsLogged: 0, listingsSaved: 0, streakWeeks: 0, checklists: ["resume"], resourcesFinished: 0 })).toEqual([]);
  });
});

describe("progress summary", () => {
  const now = at("2026-11-12T04:00:00Z"); // Thursday; week started Mon Nov 9

  it("shows the tutorial and hides streaks and the weekly quest in the first week", () => {
    const p = progressFrom([ev("profile", 50, "2026-11-11T02:00:00Z", "once"), ev("first_save", 10, "2026-11-11T03:00:00Z", "once")], {
      joinedAt: "2026-11-11T01:00:00Z",
      now,
      confirmedThisWeek: 0,
    });
    expect(p).toMatchObject({ totalExp: 60, level: 1, exp: 60, expMax: 70, isNew: true, streakWeeks: 0, weeklyQuest: null });
    expect(p.tutorial).toEqual({ profile: true, viewedMatch: false, saved: true });
  });

  it("after week one: weekly EXP, a streak, and the weekly quest", () => {
    const events = [
      ev("profile", 50, "2026-10-27T02:00:00Z", "once"),
      ev("confirm", 20, "2026-11-03T02:00:00Z", "a"),
      ev("confirm", 20, "2026-11-10T02:00:00Z", "b"),
      ev("status", 5, "2026-11-11T02:00:00Z", "b:interview"),
    ];
    const p = progressFrom(events, { joinedAt: "2026-10-27T01:00:00Z", now, confirmedThisWeek: 1 });
    expect(p).toMatchObject({ totalExp: 95, level: 2, weekExp: 25, isNew: false, streakWeeks: 3 });
    expect(p.weeklyQuest).toEqual({ goal: `Confirm ${WEEKLY_GOAL} applications`, done: 1, total: WEEKLY_GOAL });
  });
});
