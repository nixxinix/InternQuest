/**
 * Ranks listings for the explorer (landing page now, Search later).
 * Pure: takes listings and the visitor's picks, returns what to show.
 */
import type { City } from "@/lib/catalog/cities";
import type { FieldId } from "@/lib/catalog/fields";
import { canonicalSkill } from "@/lib/catalog/skills";
import { DEFAULT_RADIUS_KM } from "@/lib/matching/config";
import { isInRange, listingDistanceKm, scoreListing, type MatchProfile } from "@/lib/matching/score";
import { isClosed, type SampleListing } from "@/lib/sample/listings";
import { toSummary } from "./present";
import type { ListingSummary, WorkType } from "./types";

export type ExploreInput = {
  skills: string[];
  field: FieldId | null;
  city: City | null;
  remoteOk: boolean;
  radiusKm?: number;
  /** Logged-in users have a work type preference; visitors don't. */
  workType?: WorkType | null;
  /** Listings already in the user's quest log (not shown again as "new" matches). */
  excludeIds?: string[];
};

export type ExploreResult = {
  /** "match" once skills are picked; before that, newest first (no match bars). */
  mode: "match" | "newest";
  items: ListingSummary[];
  radiusKm: number;
  /** How many listings each filter removed, so an empty state can say why. */
  hiddenByDistance: number;
  hiddenByRemote: number;
};

export function exploreListings(listings: SampleListing[], input: ExploreInput): ExploreResult {
  const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;
  const profile: MatchProfile = {
    skills: input.skills,
    fields: input.field ? [input.field] : [],
    workType: input.workType ?? null,
    location: input.city ? { lat: input.city.lat, lng: input.city.lng } : null,
    radiusKm,
  };

  const exclude = new Set(input.excludeIds ?? []);
  let hiddenByRemote = 0;
  let hiddenByDistance = 0;
  const pool = listings.filter((l) => {
    if (isClosed(l)) return false; // closed listings never show in results
    if (exclude.has(l.id)) return false;
    if (!input.remoteOk && l.workType === "remote") {
      hiddenByRemote++;
      return false;
    }
    if (!isInRange(profile, l)) {
      hiddenByDistance++;
      return false;
    }
    return true;
  });

  if (input.skills.length === 0) {
    // Newest first, with the picked field's listings on top.
    const sorted = [...pool].sort((a, b) => {
      const fa = input.field && a.field === input.field ? 0 : 1;
      const fb = input.field && b.field === input.field ? 0 : 1;
      return fa - fb || a.postedDaysAgo - b.postedDaysAgo;
    });
    return {
      mode: "newest",
      items: sorted.map((l) => toSummary(l, null, listingDistanceKm(profile, l))),
      radiusKm,
      hiddenByDistance,
      hiddenByRemote,
    };
  }

  const scored = pool.map((l) => ({ l, m: scoreListing(profile, l, canonicalSkill) }));
  scored.sort(
    (a, b) =>
      b.m.score - a.m.score ||
      (a.m.distanceKm ?? Number.POSITIVE_INFINITY) - (b.m.distanceKm ?? Number.POSITIVE_INFINITY) ||
      a.l.postedDaysAgo - b.l.postedDaysAgo,
  );
  return {
    mode: "match",
    items: scored.map(({ l, m }) => toSummary(l, m, m.distanceKm)),
    radiusKm,
    hiddenByDistance,
    hiddenByRemote,
  };
}
