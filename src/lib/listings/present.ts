/**
 * Turns a stored listing plus its match result into what a card shows.
 * Pure functions, so the wording is tested.
 */
import type { City } from "@/lib/catalog/cities";
import { fieldLabel } from "@/lib/catalog/fields";
import { skillName } from "@/lib/catalog/skills";
import type { MatchResult } from "@/lib/matching/score";
import type { SampleListing } from "@/lib/sample/listings";
import { resourcesFor } from "@/lib/catalog/resources";
import type { MatchBreakdown, MatchPart, ListingSummary } from "./types";

/** Only shown when a deadline is close (14 days or less), so "Closing soon" means something. */
export function deadlineText(daysLeft: number | null): string | null {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return "Closed";
  if (daysLeft === 0) return "Closes today";
  if (daysLeft === 1) return "1 day left";
  if (daysLeft <= 14) return `${daysLeft} days left`;
  return null;
}

export function postedText(daysAgo: number): string {
  if (daysAgo <= 0) return "Posted today";
  if (daysAgo === 1) return "Posted yesterday";
  if (daysAgo < 14) return `Posted ${daysAgo} days ago`;
  return `Posted ${Math.floor(daysAgo / 7)} weeks ago`;
}

export function allowanceText(allowance: string | null, hours: number | null): string | null {
  const parts = [allowance, hours ? `${hours} hrs` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Saved listings closing within `days`, soonest first (Home "Closing soon"). */
export function closingSoon<T extends { id: string; deadlineInDays: number | null }>(
  listings: T[],
  savedIds: string[],
  days = 7,
): T[] {
  const saved = new Set(savedIds);
  return listings
    .filter((l) => saved.has(l.id) && l.deadlineInDays !== null && l.deadlineInDays >= 0 && l.deadlineInDays <= days)
    .sort((a, b) => (a.deadlineInDays ?? 0) - (b.deadlineInDays ?? 0));
}

export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** The "why this matched" breakdown for the Match Panel, in plain words. */
export function toBreakdown(listing: SampleListing, match: MatchResult, city: City | null): MatchBreakdown {
  const req = listing.skills.filter((s) => s.required);
  const opt = listing.skills.filter((s) => !s.required);
  const has = new Set(match.matched);
  const reqHave = req.filter((s) => has.has(s.id)).length;
  const optHave = opt.filter((s) => has.has(s.id)).length;

  const detail: Record<MatchPart["key"], string> = {
    skills:
      `${reqHave} of ${req.length} required` + (opt.length ? `, ${optHave} of ${opt.length} nice-to-have` : ""),
    distance:
      listing.workType === "remote"
        ? "Remote, so distance doesn't matter much"
        : match.distanceKm !== null && city
          ? `${formatKm(match.distanceKm)} from ${city.name}`
          : "Not counted. Add your city to include it.",
    interests:
      match.parts.interests.score === null
        ? "Not counted. Pick a field to include it."
        : match.parts.interests.score === 1
          ? `${fieldLabel(listing.field)} is your field`
          : `This one is in ${fieldLabel(listing.field)}`,
    workType:
      match.parts.workType.score === null
        ? "Not counted. Set a work type preference to include it."
        : match.parts.workType.score === 1
          ? "Matches the work type you prefer"
          : match.parts.workType.score > 0
            ? "Close to the work type you prefer"
            : "Not the work type you prefer",
  };

  const labels: Record<MatchPart["key"], string> = {
    skills: "Skills",
    distance: "Distance",
    interests: "Field",
    workType: "Work type",
  };

  return {
    pct: match.pct,
    parts: (Object.keys(labels) as MatchPart["key"][]).map((key) => ({
      key,
      label: labels[key],
      weight: match.parts[key].weight,
      score: match.parts[key].score,
      detail: detail[key],
    })),
    matched: match.matched.map(skillName),
    missing: match.missing.map((m) => ({
      name: m.required ? skillName(m.id) : `${skillName(m.id)} (nice to have)`,
      resources: resourcesFor(m.id),
    })),
  };
}

export function toSummary(listing: SampleListing, match: MatchResult | null, distanceKm: number | null): ListingSummary {
  return {
    id: listing.id,
    title: listing.title,
    company: listing.company,
    verified: listing.verified,
    area: listing.area,
    distanceKm,
    workType: listing.workType,
    allowance: allowanceText(listing.allowance, listing.hours),
    source: listing.source,
    deadlineText: deadlineText(listing.deadlineInDays),
    postedText: postedText(listing.postedDaysAgo),
    skills: listing.skills.filter((s) => s.required).map((s) => skillName(s.id)),
    match: match
      ? {
          pct: match.pct,
          matched: match.matched.map(skillName),
          missing: match.missing.filter((m) => m.required).map((m) => skillName(m.id)),
          missingNice: match.missing.filter((m) => !m.required).map((m) => skillName(m.id)),
        }
      : null,
  };
}
