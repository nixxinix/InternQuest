/**
 * How long old data is kept before the daily job deletes it
 * (supabase/migrations/0009_retention.sql). One place, so the privacy notice
 * and the code can't drift apart: src/app/privacy/page.tsx reads these too.
 *
 * PROPOSED values for the school pilot. Confirm them (and the privacy notice
 * wording) in the legal review before the public launch. Every period must be
 * at least 7 days; the database refuses anything shorter.
 */
export const RETENTION_DAYS = {
  /** Apply clicks. Companies only ever see totals. */
  clicks: 365,
  /** Reports, counted from when an admin resolved them. Open reports are kept until resolved. */
  reports: 180,
  /** Unusual-activity flags, counted from when an admin resolved them. */
  flags: 180,
  /** The log of admin decisions. Longer, so a decision can still be explained if questioned. */
  audit: 730,
  /** The daily import job's log (counts only, no personal data). */
  runs: 90,
} as const;

/** 365 -> "12 months", 730 -> "2 years", 180 -> "6 months", 10 -> "10 days". For the privacy notice. */
export function retentionLabel(days: number): string {
  if (days === 365) return "12 months";
  if (days % 365 === 0) return `${days / 365} years`;
  if (days >= 60) return `${Math.round(days / 30)} months`;
  return `${days} days`;
}
