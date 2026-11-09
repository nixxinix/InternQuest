/**
 * The common shape every listing source produces (SPEC §5.3: "a common
 * adapter interface so Jooble/Adzuna can be added"). Each adapter fetches its
 * own API and maps postings into ImportedListing with the shared helpers in
 * normalize.ts. The refresh job doesn't care which source it came from.
 */
import type { FieldId } from "@/lib/catalog/fields";
import type { WorkType } from "@/lib/listings/types";

export type ImportedListing = {
  id: string;
  source: "jsearch";
  /** The source's own id for the posting, for refreshes. */
  sourceRef: string;
  title: string;
  company: string;
  field: FieldId;
  area: string;
  lat: number | null;
  lng: number | null;
  workType: WorkType;
  /** A short snippet only (CLAUDE.md hard rule). */
  snippet: string;
  applyUrl: string;
  /** "YYYY-MM-DD" (Manila) or null. */
  deadline: string | null;
  postedAt: string;
  skills: { id: string; required: boolean }[];
  dedupeKey: string;
};

export type ParseResult = {
  listings: ImportedListing[];
  /** Why postings were left out, counted (for the import log). */
  skipped: Record<string, number>;
};

export type ListingSourceAdapter = {
  name: ImportedListing["source"];
  /** False when its API key isn't set: the job then only does the clean-up. */
  enabled(): boolean;
  fetchListings(): Promise<ParseResult>;
};
