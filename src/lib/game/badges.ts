/**
 * Badge catalog (SPEC §10). SAMPLE SET for the design: Phase 3 moves these to
 * the `badges` table and awards them on the server (`user_badges`).
 * Every badge rewards effort, never results (no "got an offer" badge).
 */
import type { SpriteName } from "@/components/ui/sprites";

export type BadgeDef = {
  id: string;
  name: string;
  sprite: SpriteName;
  /** Earned: what it was for. Locked: how to earn it. Same sentence works for both. */
  description: string;
};

export const BADGES: BadgeDef[] = [
  { id: "first-quest", name: "First quest", sprite: "star", description: "Confirm your first application" },
  { id: "prepared", name: "Prepared", sprite: "shield", description: "Finish the interview checklist" },
  { id: "follow-through", name: "Follow-through", sprite: "check", description: "Log a result for an application" },
  { id: "skill-up", name: "Skill up", sprite: "tips", description: "Finish a learning resource for a missing skill" },
  { id: "on-a-roll", name: "On a roll", sprite: "flame", description: "Keep a 4-week streak" },
  { id: "scout", name: "Scout", sprite: "search", description: "Save 5 listings" },
];

export function badgeList(earnedIds: string[]) {
  const earned = new Set(earnedIds);
  // Earned first, so the row starts with what you've done.
  return [...BADGES]
    .map((b) => ({ ...b, earned: earned.has(b.id) }))
    .sort((a, b) => Number(b.earned) - Number(a.earned));
}
