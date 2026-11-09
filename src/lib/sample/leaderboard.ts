/**
 * SAMPLE leaderboard for the design (fictional usernames). Phase 3 replaces
 * it with the server's weekly_exp rows. Weekly numbers stay within what the
 * EXP rules allow (SPEC §10: +20 for the first 3 confirmed applications a day).
 */
import type { BoardEntry, WeekTotals } from "@/lib/game/leaderboard";

const e = (
  username: string,
  school: string | null,
  weekExp: number,
  weekApps: number,
  totalExp: number,
  totalApps: number,
  hidden = false,
): BoardEntry => ({ username, school, weekExp, weekApps, totalExp, totalApps, hidden });

export const SAMPLE_BOARD: BoardEntry[] = [
  e("kape.coder", "tip-qc", 310, 6, 2890, 31),
  e("jun.builds", "up-diliman", 290, 5, 3120, 28),
  e("bea_designs", "tip-qc", 265, 5, 1540, 14),
  e("rafa.data", "ust", 240, 4, 2010, 19),
  e("lia.codes", "tip-qc", 225, 4, 1300, 11),
  e("marco.ece", "mapua", 225, 3, 990, 8),
  e("tin.sales", null, 210, 4, 760, 9),
  e("paolo_iot", "tip-qc", 205, 3, 1880, 15),
  e("gab.web", "dlsu", 200, 4, 2420, 22),
  e("ria.hr", "pup-manila", 195, 3, 640, 6),
  e("nico.civil", "usc", 190, 2, 1110, 7),
  e("sam.ux", "admu", 185, 3, 1700, 13),
  e("ella.acct", "tip-manila", 182, 3, 870, 9),
  e("mika.codes", "tip-qc", 180, 4, 1980, 12),
  e("josh.dev", "feu-tech", 160, 2, 2600, 24),
  e("andrea.comms", "ust", 150, 3, 520, 5),
  e("kai.robotics", "tip-qc", 140, 2, 1320, 10),
  e("pia.tourism", "usep", 120, 2, 430, 4),
  e("leo.mech", null, 95, 1, 300, 3),
  e("dani.data", "tip-qc", 80, 1, 610, 6),
  e("quiet.one", "tip-qc", 270, 5, 2000, 18, true), // opted out: never shown to others
  e("away.this.week", "dlsu", 0, 0, 1500, 14), // no EXP this week: not on the weekly board
];

export const SAMPLE_LAST_WEEK: WeekTotals = { exp: 140, apps: 2 };
