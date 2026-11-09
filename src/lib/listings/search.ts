/**
 * Search (W4): filters that live in the URL, and the pure function that
 * applies them. Matching uses the logged-in user's profile; the URL only
 * holds what they narrowed the results down to, so links can be shared.
 */
import type { City } from "@/lib/catalog/cities";
import { isFieldId, type FieldId } from "@/lib/catalog/fields";
import { canonicalSkill } from "@/lib/catalog/skills";
import { DEFAULT_RADIUS_KM } from "@/lib/matching/config";
import { isInRange, listingDistanceKm, scoreListing, type MatchProfile } from "@/lib/matching/score";
import { isClosed, type SampleListing } from "@/lib/sample/listings";
import { toSummary } from "./present";
import type { ListingSummary, WorkType } from "./types";

export const RADIUS_OPTIONS = [5, 10, 25, 50] as const;
export const POSTED_OPTIONS = [7, 30] as const;
export const SORTS = ["match", "newest", "deadline"] as const;
export type SearchSort = (typeof SORTS)[number];
export const SORT_LABEL: Record<SearchSort, string> = {
  match: "Best match",
  newest: "Newest",
  deadline: "Closing soonest",
};
export const MAX_QUERY_LENGTH = 80;
export const PAGE_SIZE = 10;

export type SearchFilters = {
  q: string;
  field: FieldId | null;
  radiusKm: number;
  workType: WorkType | null;
  /** Include remote listings. Ignored when a work type is picked. */
  remote: boolean;
  paid: boolean;
  moa: boolean;
  postedWithinDays: number | null;
  sort: SearchSort;
};

/** Filters that narrow results (sort and paging don't). Used for "what removed what". */
export const FILTER_KEYS = ["q", "field", "radius", "workType", "remote", "paid", "moa", "posted"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const DEFAULT_FILTERS: SearchFilters = {
  q: "",
  field: null,
  radiusKm: DEFAULT_RADIUS_KM,
  workType: null,
  remote: true,
  paid: false,
  moa: false,
  postedWithinDays: null,
  sort: "match",
};

type ParamsLike = { get(name: string): string | null };

const WORK_TYPES: WorkType[] = ["onsite", "hybrid", "remote"];

function oneOf<T extends number | string>(value: string | null, options: readonly T[]): T | null {
  if (value === null) return null;
  const found = options.find((o) => String(o) === value);
  return found ?? null;
}

/** Unknown or malformed values fall back to defaults, so a bad link never breaks the page. */
export function readSearchFilters(params: ParamsLike): SearchFilters {
  const field = params.get("field");
  return {
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    field: isFieldId(field) ? field : null,
    radiusKm: oneOf(params.get("radius"), RADIUS_OPTIONS) ?? DEFAULT_FILTERS.radiusKm,
    workType: oneOf(params.get("type"), WORK_TYPES),
    remote: params.get("remote") !== "0",
    paid: params.get("paid") === "1",
    moa: params.get("moa") === "1",
    postedWithinDays: oneOf(params.get("posted"), POSTED_OPTIONS),
    sort: oneOf(params.get("sort"), SORTS) ?? DEFAULT_FILTERS.sort,
  };
}

/** Query string for a set of filters (no leading "?"). Defaults are left out. */
export function searchQuery(f: SearchFilters): string {
  const q = new URLSearchParams();
  if (f.q) q.set("q", f.q);
  if (f.field) q.set("field", f.field);
  if (f.radiusKm !== DEFAULT_FILTERS.radiusKm) q.set("radius", String(f.radiusKm));
  if (f.workType) q.set("type", f.workType);
  if (!f.remote) q.set("remote", "0");
  if (f.paid) q.set("paid", "1");
  if (f.moa) q.set("moa", "1");
  if (f.postedWithinDays) q.set("posted", String(f.postedWithinDays));
  if (f.sort !== DEFAULT_FILTERS.sort) q.set("sort", f.sort);
  return q.toString();
}

/** The filters that differ from the defaults (radius only counts when the user has a city). */
export function activeFilters(f: SearchFilters, hasCity: boolean): FilterKey[] {
  return FILTER_KEYS.filter((k) => isActive(f, k, hasCity));
}

function isActive(f: SearchFilters, key: FilterKey, hasCity: boolean): boolean {
  switch (key) {
    case "q":
      return f.q !== "";
    case "field":
      return f.field !== null;
    case "radius":
      return hasCity && f.radiusKm !== DEFAULT_FILTERS.radiusKm;
    case "workType":
      return f.workType !== null;
    case "remote":
      return f.workType === null && !f.remote;
    case "paid":
      return f.paid;
    case "moa":
      return f.moa;
    case "posted":
      return f.postedWithinDays !== null;
  }
}

/** Returns the filters with one of them reset to its default. */
export function withoutFilter(f: SearchFilters, key: FilterKey): SearchFilters {
  switch (key) {
    case "q":
      return { ...f, q: "" };
    case "field":
      return { ...f, field: null };
    case "radius":
      return { ...f, radiusKm: DEFAULT_FILTERS.radiusKm };
    case "workType":
      return { ...f, workType: null };
    case "remote":
      return { ...f, remote: true };
    case "paid":
      return { ...f, paid: false };
    case "moa":
      return { ...f, moa: false };
    case "posted":
      return { ...f, postedWithinDays: null };
  }
}

/** Lowercase, no accents ("Parañaque" matches "paranaque"). */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** "With allowance" and amounts count as paid; "Unpaid" and unknown don't. */
export function isPaid(allowance: string | null): boolean {
  return allowance !== null && !/unpaid/i.test(allowance);
}

export type SearchProfile = {
  skills: string[];
  fields: FieldId[];
  workType: WorkType | null;
  city: City | null;
};

function matchesText(l: SampleListing, q: string): boolean {
  if (!q) return true;
  const hay = normalizeText(`${l.title} ${l.company} ${l.area}`);
  // Every word must appear somewhere ("data pasig" finds the Pasig data job).
  return normalizeText(q)
    .split(/\s+/)
    .every((word) => hay.includes(word));
}

function passes(l: SampleListing, f: SearchFilters, profile: SearchProfile, skip: FilterKey | null): boolean {
  const location = profile.city ? { lat: profile.city.lat, lng: profile.city.lng } : null;
  const check: Record<FilterKey, () => boolean> = {
    q: () => matchesText(l, f.q),
    field: () => f.field === null || l.field === f.field,
    radius: () => isInRange({ location, radiusKm: f.radiusKm }, l),
    workType: () => f.workType === null || l.workType === f.workType,
    remote: () => f.workType !== null || f.remote || l.workType !== "remote",
    paid: () => !f.paid || isPaid(l.allowance),
    moa: () => !f.moa || l.moa,
    posted: () => f.postedWithinDays === null || l.postedDaysAgo <= f.postedWithinDays,
  };
  return FILTER_KEYS.every((k) => k === skip || check[k]());
}

export type SearchResult = {
  items: ListingSummary[];
  /** Total before paging. */
  total: number;
  /** For each active filter: how many more listings would show without it. */
  removedBy: Partial<Record<FilterKey, number>>;
  /** "match" needs skills; without them results fall back to newest. */
  sortUsed: SearchSort;
};

export function searchListings(listings: SampleListing[], profile: SearchProfile, f: SearchFilters): SearchResult {
  const open = listings.filter((l) => !isClosed(l)); // closed listings never show in results
  const hasCity = profile.city !== null;
  const pool = open.filter((l) => passes(l, f, profile, null));

  const removedBy: Partial<Record<FilterKey, number>> = {};
  for (const key of activeFilters(f, hasCity)) {
    const without = open.filter((l) => passes(l, f, profile, key)).length;
    removedBy[key] = without - pool.length;
  }

  const matchProfile: MatchProfile = {
    skills: profile.skills,
    fields: profile.fields,
    workType: profile.workType,
    location: profile.city ? { lat: profile.city.lat, lng: profile.city.lng } : null,
    radiusKm: f.radiusKm,
  };
  const canMatch = profile.skills.length > 0;
  const sortUsed: SearchSort = f.sort === "match" && !canMatch ? "newest" : f.sort;

  const scored = pool.map((l) => ({ l, m: canMatch ? scoreListing(matchProfile, l, canonicalSkill) : null }));
  const byNewest = (a: SampleListing, b: SampleListing) => a.postedDaysAgo - b.postedDaysAgo;
  scored.sort((a, b) => {
    if (sortUsed === "match" && a.m && b.m) return b.m.score - a.m.score || byNewest(a.l, b.l);
    if (sortUsed === "deadline") {
      const da = a.l.deadlineInDays ?? Number.POSITIVE_INFINITY;
      const db = b.l.deadlineInDays ?? Number.POSITIVE_INFINITY;
      return da - db || byNewest(a.l, b.l);
    }
    return byNewest(a.l, b.l);
  });

  return {
    items: scored.map(({ l, m }) => toSummary(l, m, m ? m.distanceKm : listingDistanceKm(matchProfile, l))),
    total: pool.length,
    removedBy,
    sortUsed,
  };
}
