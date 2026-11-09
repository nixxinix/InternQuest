/**
 * Rule-based matching (SPEC §7). Pure functions: no I/O, easy to test.
 *
 * A part the system has no data for (no city typed, no field picked, no
 * work type preference, a listing with no skills) is NOT counted, and the
 * remaining weights are scaled up to 100%. A missing answer never punishes
 * a listing, and the breakdown says which parts were left out.
 */
import type { WorkType } from "@/lib/listings/types";
import {
  FULL_DISTANCE_SCORE_KM,
  MATCH_WEIGHTS,
  REMOTE_DISTANCE_SCORE,
  SKILL_WEIGHT,
  WORK_TYPE_SCORE,
} from "./config";
import { haversineKm, type LatLng } from "./geo";

export type PartKey = keyof typeof MATCH_WEIGHTS;

export type MatchProfile = {
  skills: string[];
  /** Fields the user is interested in (their class plus any extra interests). */
  fields: string[];
  workType: WorkType | null;
  location: LatLng | null;
  radiusKm: number;
};

export type MatchableListing = {
  field: string;
  workType: WorkType;
  location: LatLng | null;
  skills: { id: string; required: boolean }[];
};

export type PartResult = {
  key: PartKey;
  weight: number;
  /** 0..1, or null when this part was not counted. */
  score: number | null;
};

export type MatchResult = {
  /** 0..100, rounded. */
  pct: number;
  /** 0..1, unrounded. */
  score: number;
  parts: Record<PartKey, PartResult>;
  /** Listing skill ids the user has, required first. */
  matched: string[];
  /** Listing skill ids the user lacks, required first. */
  missing: { id: string; required: boolean }[];
  /** null for remote listings or when either location is unknown. */
  distanceKm: number | null;
};

type Normalize = (id: string) => string;
const identity: Normalize = (id) => id;

const requiredFirst = <T extends { required: boolean }>(a: T, b: T) => Number(b.required) - Number(a.required);

/** Weighted overlap. Required skills weigh 2, nice-to-have 1. null when the listing lists no skills. */
export function skillScore(
  userSkills: string[],
  listingSkills: MatchableListing["skills"],
  normalize: Normalize = identity,
) {
  const have = new Set(userSkills.map(normalize));
  let total = 0;
  let got = 0;
  const matched: { id: string; required: boolean }[] = [];
  const missing: { id: string; required: boolean }[] = [];
  for (const s of listingSkills) {
    const w = s.required ? SKILL_WEIGHT.required : SKILL_WEIGHT.nice;
    total += w;
    if (have.has(normalize(s.id))) {
      got += w;
      matched.push(s);
    } else {
      missing.push(s);
    }
  }
  matched.sort(requiredFirst);
  missing.sort(requiredFirst);
  return { score: total === 0 ? null : got / total, matched: matched.map((s) => s.id), missing };
}

/** 1.0 within 5 km, straight decline to 0 at the user's radius (SPEC §7). */
export function distanceScore(km: number, radiusKm: number): number {
  if (km <= FULL_DISTANCE_SCORE_KM) return 1;
  if (km >= radiusKm) return 0;
  return 1 - (km - FULL_DISTANCE_SCORE_KM) / (radiusKm - FULL_DISTANCE_SCORE_KM);
}

/** Distance from the user to an onsite or hybrid listing, or null if unknown or remote. */
export function listingDistanceKm(profile: Pick<MatchProfile, "location">, listing: MatchableListing): number | null {
  if (listing.workType === "remote" || !profile.location || !listing.location) return null;
  return haversineKm(profile.location, listing.location);
}

/** Remote listings and unknown locations are always in range; others must be within the radius. */
export function isInRange(profile: Pick<MatchProfile, "location" | "radiusKm">, listing: MatchableListing): boolean {
  const km = listingDistanceKm(profile, listing);
  return km === null || km <= profile.radiusKm;
}

export function scoreListing(
  profile: MatchProfile,
  listing: MatchableListing,
  normalize: Normalize = identity,
): MatchResult {
  const skills = skillScore(profile.skills, listing.skills, normalize);
  const distanceKm = listingDistanceKm(profile, listing);

  const scores: Record<PartKey, number | null> = {
    skills: skills.score,
    distance:
      listing.workType === "remote"
        ? REMOTE_DISTANCE_SCORE
        : distanceKm === null
          ? null
          : distanceScore(distanceKm, profile.radiusKm),
    interests: profile.fields.length === 0 ? null : profile.fields.includes(listing.field) ? 1 : 0,
    workType: profile.workType === null ? null : WORK_TYPE_SCORE[profile.workType][listing.workType],
  };

  let weightSum = 0;
  let total = 0;
  const parts = {} as Record<PartKey, PartResult>;
  for (const key of Object.keys(MATCH_WEIGHTS) as PartKey[]) {
    const weight = MATCH_WEIGHTS[key];
    const score = scores[key];
    parts[key] = { key, weight, score };
    if (score !== null) {
      weightSum += weight;
      total += weight * score;
    }
  }

  const score = weightSum === 0 ? 0 : total / weightSum;
  return {
    pct: Math.round(score * 100),
    score,
    parts,
    matched: skills.matched,
    missing: skills.missing,
    distanceKm,
  };
}
