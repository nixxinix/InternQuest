/**
 * A listing as the app uses it, mapped from the `internships` table.
 * Pure (no Supabase imports), so the mapping is unit tested.
 * The shape is the one the sample data already uses, so every screen,
 * the matching engine, and the search work on both.
 */
import { isFieldId } from "@/lib/catalog/fields";
import { isSkillId } from "@/lib/catalog/skills";
import type { SampleListing } from "@/lib/sample/listings";
import type { ListingSource, WorkType } from "./types";

export type Listing = SampleListing;

export type ListingRow = {
  id: string;
  title: string;
  company_name: string;
  verified: boolean;
  source: string;
  field_id: string;
  area: string;
  lat: number | string | null;
  lng: number | string | null;
  work_type: string;
  allowance: string | null;
  hours: number | null;
  moa: boolean;
  /** "YYYY-MM-DD" */
  deadline: string | null;
  posted_at: string;
  snippet: string;
  apply_kind: string;
  apply_url: string | null;
  apply_email: string | null;
  is_active: boolean;
  internship_skills: { skill_id: string; required: boolean }[] | null;
};

/** The columns the app reads (no dedupe key or internal refs). */
export const LISTING_COLUMNS =
  "id, title, company_name, verified, source, field_id, area, lat, lng, work_type, allowance, hours, moa, deadline, posted_at, snippet, apply_kind, apply_url, apply_email, is_active, internship_skills(skill_id, required)";

const SOURCES: ListingSource[] = ["jsearch", "direct", "admin"];
const WORK_TYPES: WorkType[] = ["onsite", "hybrid", "remote"];

/** Whole days from `from` to `to`, both "YYYY-MM-DD" (Manila dates). */
export function daysBetween(from: string, to: string): number {
  const t = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((t(to) - t(from)) / 86_400_000);
}

/**
 * Maps one row. `today` is the Manila date ("YYYY-MM-DD"). A listing that's
 * inactive or past its deadline comes out closed (negative deadlineInDays),
 * which every list already hides. Rows the app can't show safely give null.
 */
export function listingFromRow(row: ListingRow, today: string, now: Date): Listing | null {
  if (!isFieldId(row.field_id)) return null;
  if (!SOURCES.includes(row.source as ListingSource) || !WORK_TYPES.includes(row.work_type as WorkType)) return null;

  const apply =
    row.apply_kind === "link" && row.apply_url?.startsWith("https://")
      ? ({ kind: "link", url: row.apply_url } as const)
      : row.apply_kind === "email" && row.apply_email
        ? ({ kind: "email", email: row.apply_email } as const)
        : null;
  if (!apply) return null;

  const validDeadline = typeof row.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.deadline) ? row.deadline : null;
  let deadlineInDays = validDeadline ? daysBetween(today, validDeadline) : null;
  if (!row.is_active) deadlineInDays = Math.min(deadlineInDays ?? -1, -1);

  const lat = row.lat === null ? null : Number(row.lat);
  const lng = row.lng === null ? null : Number(row.lng);
  const posted = new Date(row.posted_at).getTime();

  return {
    id: row.id,
    title: row.title,
    company: row.company_name,
    verified: row.verified,
    area: row.area,
    location: lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    workType: row.work_type as WorkType,
    field: row.field_id,
    allowance: row.allowance,
    hours: row.hours,
    moa: row.moa,
    source: row.source as ListingSource,
    deadlineInDays,
    postedDaysAgo: Number.isFinite(posted) ? Math.max(0, Math.floor((now.getTime() - posted) / 86_400_000)) : 0,
    // Required skills first, as the sample data lists them.
    skills: (row.internship_skills ?? [])
      .filter((s) => isSkillId(s.skill_id))
      .sort((a, b) => Number(b.required) - Number(a.required))
      .map((s) => ({ id: s.skill_id, required: s.required })),
    snippet: row.snippet,
    apply,
  };
}

export function isClosed(listing: Listing): boolean {
  return listing.deadlineInDays !== null && listing.deadlineInDays < 0;
}
