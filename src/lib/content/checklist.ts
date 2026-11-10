/**
 * Guide checklists. Pure state changes, so the "+10 EXP once" rule is tested.
 * The server keeps the real record and grants EXP in Phase 3; until then the
 * state lives on the device.
 */

export type ChecklistState = { done: string[]; rewarded: boolean };

export const EMPTY_CHECKLIST: ChecklistState = { done: [], rewarded: false };

/** Only ids still in the guide count (a guide can change after someone ticked an old item). */
export function doneCount(state: ChecklistState, ids: string[]): number {
  const set = new Set(state.done);
  return ids.filter((id) => set.has(id)).length;
}

/**
 * Ticks or unticks one item. `completedNow` is true only the first time every
 * item is ticked, which is when the one-time reward is due (SPEC §10:
 * "Finish a tips checklist +10"). Unticking later never takes it back.
 */
export function toggleItem(state: ChecklistState, id: string, ids: string[]): { state: ChecklistState; completedNow: boolean } {
  const done = state.done.includes(id) ? state.done.filter((d) => d !== id) : [...state.done, id];
  const complete = ids.length > 0 && doneCount({ done, rewarded: state.rewarded }, ids) === ids.length;
  const completedNow = complete && !state.rewarded;
  return { state: { done, rewarded: state.rewarded || complete }, completedNow };
}

export function parseChecklist(raw: string | null): ChecklistState {
  if (!raw) return EMPTY_CHECKLIST;
  try {
    const v = JSON.parse(raw) as Partial<ChecklistState>;
    return {
      done: Array.isArray(v.done) ? v.done.filter((d): d is string => typeof d === "string") : [],
      rewarded: v.rewarded === true,
    };
  } catch {
    return EMPTY_CHECKLIST;
  }
}
