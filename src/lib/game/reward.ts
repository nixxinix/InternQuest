/**
 * Display-side level math for showing a reward the server already granted.
 * The server owns EXP (CLAUDE.md hard rule); the client only animates the
 * result it gets back. Phase 3 replaces the flat `expMax` with the real
 * level curve.
 */

export type LevelState = { level: number; exp: number; expMax: number };

export function applyExp(state: LevelState, amount: number): LevelState & { leveledUp: boolean } {
  if (amount <= 0) return { ...state, leveledUp: false };
  let { level, exp } = state;
  exp += amount;
  let leveledUp = false;
  while (exp >= state.expMax) {
    exp -= state.expMax;
    level += 1;
    leveledUp = true;
  }
  return { level, exp, expMax: state.expMax, leveledUp };
}

/** What a level unlocks, for the level-up card (SPEC §10 gradual unlock). */
export function unlockAt(level: number): string | null {
  if (level === 3) return "Weekly leaderboard";
  return null;
}
