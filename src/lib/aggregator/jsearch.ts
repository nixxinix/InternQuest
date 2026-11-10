/**
 * JSearch (RapidAPI) adapter, pure part: the request URL and turning its
 * answer into ImportedListings. The network call is in refresh.ts.
 *
 * Every field is read defensively: an unexpected or missing value skips that
 * posting (counted in the import log) rather than failing the whole run.
 */
import { findCityByName, isInPhilippines } from "@/lib/catalog/cities";
import { dedupeKey } from "@/lib/listings/dedupe";
import { manilaDate } from "@/lib/tracker/log";
import { findSkills, inferField, isInternship, listingId, makeSnippet, safeApplyUrl } from "./normalize";
import type { ImportedListing, ParseResult } from "./types";

export const JSEARCH_HOST = "jsearch.p.rapidapi.com";

/**
 * Searches run by the daily job. Two requests a day (about 60 a month) to stay
 * inside small free plans; check your RapidAPI plan's quota before adding more.
 */
export const JSEARCH_QUERIES = ["internship in Philippines", "OJT in Philippines"] as const;

/** JSearch v5's search endpoint (the old "/search" no longer exists). */
export const JSEARCH_PATH = "/search-v2";

export function jsearchUrl(query: string): string {
  const params = new URLSearchParams({
    query,
    num_pages: "1",
    country: "ph",
    date_posted: "month",
  });
  return `https://${JSEARCH_HOST}${JSEARCH_PATH}?${params}`;
}

type JSearchJob = {
  job_id?: unknown;
  job_uid?: unknown;
  employer_name?: unknown;
  job_title?: unknown;
  job_description?: unknown;
  job_apply_link?: unknown;
  job_city?: unknown;
  job_state?: unknown;
  job_country?: unknown;
  job_latitude?: unknown;
  job_longitude?: unknown;
  job_is_remote?: unknown;
  job_posted_at_datetime_utc?: unknown;
  job_offer_expiration_datetime_utc?: unknown;
  job_employment_type?: unknown;
  job_employment_types?: unknown;
  job_highlights?: { Qualifications?: unknown } | null;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function parseJsearch(json: unknown, now: Date): ParseResult {
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  // v5 answers { data: { jobs: [...] } }; the older shape was { data: [...] }.
  const raw = (json as { data?: unknown })?.data;
  const data = Array.isArray(raw) ? raw : (raw as { jobs?: unknown } | null)?.jobs;
  if (!Array.isArray(data)) return { listings: [], skipped: { "unexpected answer": 1 } };

  const listings: ImportedListing[] = [];
  for (const job of data as JSearchJob[]) {
    // job_uid is short and stable; job_id in v5 is a ~350-character token, too long to look up in bulk.
    const sourceRef = str(job.job_uid) || str(job.job_id);
    const title = str(job.job_title).slice(0, 120);
    const company = str(job.employer_name).slice(0, 120);
    if (!sourceRef || title.length < 3 || !company) {
      skip("missing title or company");
      continue;
    }
    const country = str(job.job_country).toUpperCase();
    if (country && country !== "PH") {
      skip("outside the Philippines");
      continue;
    }
    const types = [str(job.job_employment_type), ...strs(job.job_employment_types)].filter(Boolean);
    if (!isInternship(title, types)) {
      skip("not an internship");
      continue;
    }
    const applyUrl = safeApplyUrl(job.job_apply_link);
    if (!applyUrl) {
      skip("no https apply link");
      continue;
    }

    const description = str(job.job_description);
    const qualifications = strs(job.job_highlights?.Qualifications).join(" ");
    const skills = findSkills(`${title} ${description}`).slice(0, 8);
    const required = new Set(findSkills(`${title} ${qualifications}`));
    const field = inferField(title, description, skills);
    if (!field) {
      skip("field unclear");
      continue;
    }

    const remote = job.job_is_remote === true;
    const city = str(job.job_city);
    const area = ([city, str(job.job_state)].filter(Boolean).join(", ") || (remote ? "Anywhere in the Philippines" : "Philippines")).slice(0, 120);
    // The posting's own location, else our city list. No map lookups in bulk (Nominatim's policy).
    let lat = typeof job.job_latitude === "number" ? job.job_latitude : null;
    let lng = typeof job.job_longitude === "number" ? job.job_longitude : null;
    if (lat === null || lng === null || !isInPhilippines(lat, lng)) {
      const known = city ? findCityByName(city) : null;
      lat = known?.lat ?? null;
      lng = known?.lng ?? null;
    }

    const posted = new Date(str(job.job_posted_at_datetime_utc));
    const expires = new Date(str(job.job_offer_expiration_datetime_utc));
    const snippet = makeSnippet(description || qualifications || title);
    if (!snippet) {
      skip("no description");
      continue;
    }

    listings.push({
      id: listingId("js", company, title, sourceRef),
      source: "jsearch",
      sourceRef,
      title,
      company,
      field,
      area,
      lat: remote ? null : lat,
      lng: remote ? null : lng,
      workType: remote ? "remote" : "onsite",
      snippet,
      applyUrl,
      deadline: Number.isNaN(expires.getTime()) ? null : manilaDate(expires),
      postedAt: Number.isNaN(posted.getTime()) ? now.toISOString() : posted.toISOString(),
      skills: skills.map((id) => ({ id, required: required.has(id) })),
      dedupeKey: dedupeKey(company, title, remote ? "remote" : area),
    });
  }
  return { listings, skipped };
}

