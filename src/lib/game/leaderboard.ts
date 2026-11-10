/**
 * Leaderboard rules (SPEC §10, decision S4 option 1). Pure functions: the
 * server runs these in Phase 3 (weekly_exp table, Monday reset in Asia/Manila).
 * The client never computes ranks from its own numbers.
 *
 * - Ranked by EXP only. Applications are shown, never ranked, so nobody is
 *   pushed to send low-effort applications to climb.
 * - Ties share a rank (1, 2, 2, 4) and are listed by username for a stable order.
 * - Usernames only. People who opted out are left out for everyone else; they
 *   still see where they would be ("Only you can see this").
 */

export type Period = "week" | "all";
export type BoardGroup = "overall" | "school";

export type BoardEntry = {
  username: string;
  school: string | null;
  weekExp: number;
  weekApps: number;
  totalExp: number;
  totalApps: number;
  /** "Show me on the leaderboard" is off. */
  hidden: boolean;
};

export type RankedRow = {
  rank: number;
  username: string;
  exp: number;
  apps: number;
  isYou: boolean;
  /** Your row while you're hidden: shown only to you. */
  onlyYou: boolean;
};

export function rankBoard(
  entries: BoardEntry[],
  opts: { period: Period; group: BoardGroup; you: string; yourSchool: string | null },
): RankedRow[] {
  const pick = (e: BoardEntry) =>
    opts.period === "week" ? { exp: e.weekExp, apps: e.weekApps } : { exp: e.totalExp, apps: e.totalApps };

  const pool = entries.filter((e) => {
    const isYou = e.username === opts.you;
    if (e.hidden && !isYou) return false;
    if (opts.group === "school" && (!opts.yourSchool || e.school !== opts.yourSchool)) return false;
    // A week with no EXP isn't "last place": only people who did something this week are listed.
    if (opts.period === "week" && e.weekExp <= 0 && !isYou) return false;
    return true;
  });

  const sorted = pool
    .map((e) => ({ e, ...pick(e) }))
    .sort((a, b) => b.exp - a.exp || a.e.username.localeCompare(b.e.username));

  let rank = 0;
  let prevExp: number | null = null;
  return sorted.map((row, i) => {
    if (row.exp !== prevExp) rank = i + 1;
    prevExp = row.exp;
    const isYou = row.e.username === opts.you;
    return { rank, username: row.e.username, exp: row.exp, apps: row.apps, isYou, onlyYou: isYou && row.e.hidden };
  });
}

/* ------------------------------------------------------------------------ */
/* Personal best: always shown first, so the board is never "just a rank"    */
/* ------------------------------------------------------------------------ */

export type WeekTotals = { exp: number; apps: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Compares you with yourself, never with others. Never shaming (SPEC §10). */
export function personalBest(thisWeek: WeekTotals, lastWeek: WeekTotals | null): string {
  if (!lastWeek) return "Your first week on the board. From next week, you'll see how you compare with yourself.";
  const dExp = thisWeek.exp - lastWeek.exp;
  const dApps = thisWeek.apps - lastWeek.apps;
  if (dExp > 0) {
    return dApps > 0
      ? `You beat last week by ${dExp} EXP and ${plural(dApps, "application", "applications")}.`
      : `You beat last week by ${dExp} EXP.`;
  }
  if (dExp === 0) return "Same as last week. Steady counts.";
  return `Last week you earned ${lastWeek.exp} EXP. ${-dExp} more to match it, and resting is fine too.`;
}

/* ------------------------------------------------------------------------ */
/* Weekly reset: Monday 00:00, Asia/Manila                                   */
/* ------------------------------------------------------------------------ */

/** 1 = Monday ... 7 = Sunday, in Manila. */
export function manilaWeekday(now: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(now);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name) + 1;
}

/** "Resets tomorrow" / "Resets in 4 days" (always next Monday, Manila time). */
export function resetText(now: Date): string {
  const days = 8 - manilaWeekday(now);
  return days === 1 ? "Resets tomorrow (Monday, Manila time)" : `Resets in ${days} days (Monday, Manila time)`;
}

/* ------------------------------------------------------------------------ */
/* Unlock                                                                    */
/* ------------------------------------------------------------------------ */

export const LEADERBOARD_LEVEL = 3;

/**
 * How far the user is from the Level 3 unlock. The exact EXP is only known
 * inside the level just before it (the level curve is set in Phase 3).
 */
export function unlockDistance(p: { level: number; exp: number; expMax: number }): string | null {
  if (p.level >= LEADERBOARD_LEVEL) return null;
  if (p.level === LEADERBOARD_LEVEL - 1) return `You're ${Math.max(0, p.expMax - p.exp)} EXP away.`;
  return `You're ${LEADERBOARD_LEVEL - p.level} levels away.`;
}
