import { describe, expect, it } from "vitest";
import {
  manilaWeekday,
  personalBest,
  rankBoard,
  resetText,
  unlockDistance,
  type BoardEntry,
} from "@/lib/game/leaderboard";
import { SAMPLE_BOARD } from "@/lib/sample/leaderboard";

const entry = (username: string, weekExp: number, extra: Partial<BoardEntry> = {}): BoardEntry => ({
  username,
  school: null,
  weekExp,
  weekApps: 1,
  totalExp: weekExp * 10,
  totalApps: 5,
  hidden: false,
  ...extra,
});

const week = (entries: BoardEntry[], you = "me", group: "overall" | "school" = "overall", yourSchool: string | null = null) =>
  rankBoard(entries, { period: "week", group, you, yourSchool });

describe("rankBoard", () => {
  it("ranks by EXP, gives ties the same rank, and orders ties by username", () => {
    const rows = week([entry("cara", 100), entry("bo", 200), entry("al", 100), entry("dee", 50)]);
    expect(rows.map((r) => [r.rank, r.username])).toEqual([
      [1, "bo"],
      [2, "al"],
      [2, "cara"],
      [4, "dee"],
    ]);
  });

  it("never ranks by applications", () => {
    const rows = week([entry("many.apps", 100, { weekApps: 30 }), entry("few.apps", 150, { weekApps: 1 })]);
    expect(rows[0].username).toBe("few.apps");
  });

  it("leaves out people who opted out, except for themselves", () => {
    const board = [entry("shy", 300, { hidden: true }), entry("me", 100)];
    expect(week(board).map((r) => r.username)).toEqual(["me"]);
    const mine = week(board, "shy");
    expect(mine[0]).toMatchObject({ username: "shy", rank: 1, onlyYou: true });
  });

  it("only lists people with EXP this week, but always lists you", () => {
    const rows = week([entry("busy", 50), entry("resting", 0), entry("me", 0)]);
    expect(rows.map((r) => r.username)).toEqual(["busy", "me"]);
  });

  it("groups by your school, and shows nobody when you have no school", () => {
    const board = [entry("a", 100, { school: "tip-qc" }), entry("b", 90, { school: "ust" }), entry("me", 80, { school: "tip-qc" })];
    expect(week(board, "me", "school", "tip-qc").map((r) => r.username)).toEqual(["a", "me"]);
    expect(week(board, "me", "school", null)).toEqual([]);
  });

  it("uses all-time totals for the all-time tab", () => {
    const rows = rankBoard([entry("a", 10, { totalExp: 900 }), entry("b", 200, { totalExp: 100 })], {
      period: "all",
      group: "overall",
      you: "x",
      yourSchool: null,
    });
    expect(rows.map((r) => [r.username, r.exp])).toEqual([
      ["a", 900],
      ["b", 100],
    ]);
  });

  it("works on the sample board", () => {
    const rows = rankBoard(SAMPLE_BOARD, { period: "week", group: "overall", you: "mika.codes", yourSchool: "tip-qc" });
    expect(rows.find((r) => r.username === "quiet.one")).toBeUndefined();
    expect(rows.find((r) => r.username === "away.this.week")).toBeUndefined();
    expect(rows.find((r) => r.isYou)).toMatchObject({ rank: 14, exp: 180 });
  });
});

describe("personalBest (you vs. last week, never vs. others)", () => {
  it("celebrates beating last week", () => {
    expect(personalBest({ exp: 180, apps: 4 }, { exp: 140, apps: 2 })).toBe("You beat last week by 40 EXP and 2 applications.");
    expect(personalBest({ exp: 180, apps: 1 }, { exp: 140, apps: 2 })).toBe("You beat last week by 40 EXP.");
  });

  it("is kind when it's the same or lower", () => {
    expect(personalBest({ exp: 100, apps: 1 }, { exp: 100, apps: 3 })).toBe("Same as last week. Steady counts.");
    expect(personalBest({ exp: 60, apps: 1 }, { exp: 100, apps: 3 })).toMatch(/40 more to match it, and resting is fine too/);
  });

  it("explains the first week", () => {
    expect(personalBest({ exp: 50, apps: 1 }, null)).toMatch(/first week/);
  });
});

describe("weekly reset (Monday, Asia/Manila)", () => {
  it("uses Manila's weekday, not the server's", () => {
    // Sunday 17:00 UTC is already Monday 1:00 AM in Manila.
    expect(manilaWeekday(new Date("2026-11-08T17:00:00Z"))).toBe(1);
    expect(manilaWeekday(new Date("2026-11-08T15:00:00Z"))).toBe(7);
  });

  it("counts the days to the next Monday", () => {
    expect(resetText(new Date("2026-11-08T03:00:00Z"))).toMatch(/^Resets tomorrow/); // Sunday in Manila
    expect(resetText(new Date("2026-11-09T03:00:00Z"))).toMatch(/^Resets in 7 days/); // Monday
    expect(resetText(new Date("2026-11-12T03:00:00Z"))).toMatch(/^Resets in 4 days/); // Thursday
  });
});

describe("unlock at Level 3", () => {
  it("says how far away it is", () => {
    expect(unlockDistance({ level: 2, exp: 140, expMax: 200 })).toBe("You're 60 EXP away.");
    expect(unlockDistance({ level: 1, exp: 50, expMax: 100 })).toBe("You're 2 levels away.");
    expect(unlockDistance({ level: 3, exp: 0, expMax: 300 })).toBeNull();
  });
});
