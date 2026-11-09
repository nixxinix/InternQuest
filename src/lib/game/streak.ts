/**
 * Weekly streaks (SPEC §10), in Asia/Manila time. Pure and unit tested.
 *
 * - A week runs Monday to Sunday (Manila) and counts if the user earned any
 *   EXP in it (any qualifying action).
 * - One "rest week" per calendar month keeps the streak alive: a single
 *   missed week is forgiven if that month's rest week is still unused. Rest
 *   weeks don't add to the count.
 * - The current week isn't over yet, so an empty current week doesn't break
 *   the streak; it just isn't counted until something happens.
 */
import { addDays, manilaDate } from "@/lib/tracker/log";

/** The Monday (Manila) of the week containing `now`, as YYYY-MM-DD. */
export function manilaWeekStart(now: Date): string {
  const today = manilaDate(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, -((weekday + 6) % 7));
}

/** That Monday 00:00 in Manila, as a UTC timestamp (for database queries). */
export function weekStartInstant(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00+08:00`).toISOString();
}

export type Streak = { weeks: number; restWeekAvailable: boolean };

/**
 * @param activeWeeks Mondays (YYYY-MM-DD) of weeks with at least one EXP event.
 * @param currentWeek Monday of this week.
 */
export function computeStreak(activeWeeks: Iterable<string>, currentWeek: string): Streak {
  const active = new Set(activeWeeks);
  const usedRest = new Set<string>(); // months ("YYYY-MM") whose rest week is used
  let weeks = 0;
  // Start from this week if it already counts, else from last week (this one isn't over).
  let week = active.has(currentWeek) ? currentWeek : addDays(currentWeek, -7);

  for (let guard = 0; guard < 520; guard++) {
    if (active.has(week)) {
      weeks += 1;
    } else {
      const month = week.slice(0, 7);
      const earlier = addDays(week, -7);
      // Forgive one missed week a month, only between active weeks (never the start of nothing).
      if (weeks > 0 && !usedRest.has(month) && active.has(earlier)) {
        usedRest.add(month);
      } else {
        break;
      }
    }
    week = addDays(week, -7);
  }

  return { weeks, restWeekAvailable: !usedRest.has(currentWeek.slice(0, 7)) };
}
