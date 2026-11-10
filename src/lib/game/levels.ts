/**
 * The level curve (Phase 3). Pure, used by the server to turn total EXP into
 * a level, and by the client only to display what the server sent.
 *
 * Level 2 at 70 EXP, so the tutorial alone reaches it (profile +50, view a
 * match +10, save a listing +10; decision S2). After that each level needs
 * 50 EXP more than the one before: 150, 250, 350, ... Level 3 (the weekly
 * leaderboard) is at 220 EXP in total.
 */

export const MAX_LEVEL = 99;

/** EXP needed to go from `level` to `level + 1`. */
export function expToNext(level: number): number {
  return level <= 1 ? 70 : 100 * level - 50;
}

/** Total EXP at which `level` starts. */
export function levelStart(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += expToNext(l);
  return total;
}

export type LevelProgress = { level: number; exp: number; expMax: number };

/** Total EXP to level, plus progress inside it (for the EXP bar). */
export function levelFor(totalExp: number): LevelProgress {
  const total = Math.max(0, Math.floor(totalExp));
  let level = 1;
  let start = 0;
  while (level < MAX_LEVEL && total >= start + expToNext(level)) {
    start += expToNext(level);
    level += 1;
  }
  return { level, exp: total - start, expMax: expToNext(level) };
}
