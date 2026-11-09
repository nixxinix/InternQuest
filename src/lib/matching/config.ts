/**
 * Matching config: the ONE place to tune the score (SPEC §7, CLAUDE.md).
 * score = 0.50 skills + 0.25 distance + 0.15 interest/field + 0.10 work type
 */
import type { WorkType } from "@/lib/listings/types";

export const MATCH_WEIGHTS = {
  skills: 0.5,
  distance: 0.25,
  interests: 0.15,
  workType: 0.1,
} as const;

/** Required skills count double (SPEC §7). */
export const SKILL_WEIGHT = { required: 2, nice: 1 } as const;

/** Full distance score up to this many km, then a straight decline to 0 at the user's radius. */
export const FULL_DISTANCE_SCORE_KM = 5;

/** Remote listings get a fixed distance score (SPEC §7). */
export const REMOTE_DISTANCE_SCORE = 0.8;

/** Radius used until the user picks their own. */
export const DEFAULT_RADIUS_KM = 25;

/**
 * Work type fit: WORK_TYPE_SCORE[what the user prefers][what the listing offers].
 * Hybrid sits halfway between onsite and remote.
 */
export const WORK_TYPE_SCORE: Record<WorkType, Record<WorkType, number>> = {
  onsite: { onsite: 1, hybrid: 0.5, remote: 0 },
  hybrid: { onsite: 0.5, hybrid: 1, remote: 0.5 },
  remote: { onsite: 0, hybrid: 0.5, remote: 1 },
};
