/**
 * Design-preview level math only (sample amounts, flat `expMax`). With real
 * accounts the server owns EXP and the level curve (src/lib/game/levels.ts,
 * src/lib/game/server.ts); screens show its numbers through useReward().fromServer.
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
