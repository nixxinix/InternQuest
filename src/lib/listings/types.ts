/**
 * UI-facing listing shapes. The database types and the matching engine
 * (Phase 1 and 2) map into these.
 */

export type WorkType = "onsite" | "remote" | "hybrid";
export type ListingSource = "jsearch" | "direct" | "admin";

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  onsite: "Onsite",
  remote: "Remote",
  hybrid: "Hybrid",
};

export const SOURCE_LABEL: Record<ListingSource, string> = {
  jsearch: "via JSearch",
  direct: "Posted directly",
  admin: "Added by admin",
};

export type ListingSummary = {
  id: string;
  title: string;
  company: string;
  verified: boolean;
  area: string;
  /** null when the user has no city set, or for remote listings. */
  distanceKm: number | null;
  workType: WorkType;
  /** "₱500/day", "With allowance", "Unpaid", or null when unknown. */
  allowance: string | null;
  source: ListingSource;
  /** Human text such as "3 days left". Only present when there is a deadline (M4). */
  deadlineText?: string | null;
  postedText?: string | null;
  /** Required skill names, shown when there is no match yet (visitor hasn't picked skills). */
  skills?: string[];
  /**
   * null before the visitor has picked any skills.
   * `missing` = required skills the user lacks; `missingNice` = optional ones,
   * shown separately and softer, so a listing never looks harder than it is.
   */
  match: { pct: number; matched: string[]; missing: string[]; missingNice?: string[] } | null;
};

export type LearningResource = {
  /** Stable id ("python-1"), used by /learn/:id. */
  id: string;
  title: string;
  url: string;
  type: "video" | "course" | "article" | "docs";
};

/** One part of the score, for the "why this matched" breakdown. */
export type MatchPart = {
  key: "skills" | "distance" | "interests" | "workType";
  label: string;
  /** 0..1, or null when this part wasn't counted (no data for it). */
  score: number | null;
  /** Weight from the matching config, 0..1. */
  weight: number;
  detail: string;
};

export type MatchBreakdown = {
  pct: number;
  parts: MatchPart[];
  matched: string[];
  missing: { name: string; resources: LearningResource[] }[];
};
