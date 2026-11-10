/**
 * Database rows for the admin queue (Phase 6), mapped into the pure
 * QueueItem shapes from src/lib/admin/queue.ts. The mapping itself is pure
 * and unit tested; the queries that gather the rows live in
 * src/lib/admin/server.ts (joins, counts, and per-flag sums are easier to
 * read as a few small queries than as one large one).
 */
import type { CompanyRow } from "@/lib/company/account";
import { REPORT_REASON_LABEL, type CompanyItem, type FlagItem, type ReportItem, type ReportReason } from "./queue";

function hoursAgo(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 3_600_000));
}

export function companyRowToItem(row: CompanyRow, draftListings: number, now: Date): CompanyItem {
  return {
    kind: "company",
    id: row.id,
    name: row.name,
    email: row.work_email,
    website: row.website,
    role: row.role,
    registrationNo: row.registration_no,
    submittedHoursAgo: hoursAgo(row.created_at, now),
    emailConfirmed: row.email_confirmed,
    websiteLoads: row.website_loads === true,
    draftListings,
  };
}

export type ReportRow = {
  id: number;
  internship_id: string;
  reason: string;
  note: string | null;
  created_at: string;
};

export type ReportedListing = { title: string; company: string; snippet: string };

const isReportReason = (r: string): r is ReportReason => r in REPORT_REASON_LABEL;

/** Every open report for one listing, grouped into the counts-per-reason shape the queue shows. */
export function groupReportsForListing(internshipId: string, rows: ReportRow[], listing: ReportedListing, now: Date): ReportItem {
  const counts = new Map<ReportReason, number>();
  const notes: string[] = [];
  let oldest = now;
  for (const r of rows) {
    if (isReportReason(r.reason)) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
    if (r.note?.trim()) notes.push(r.note.trim());
    const at = new Date(r.created_at);
    if (at < oldest) oldest = at;
  }
  const reasons = (Object.keys(REPORT_REASON_LABEL) as ReportReason[])
    .filter((r) => counts.has(r))
    .map((reason) => ({ reason, count: counts.get(reason)! }));
  return {
    kind: "report",
    id: `r-${internshipId}`,
    listingTitle: listing.title,
    company: listing.company,
    snippet: listing.snippet,
    reasons,
    notes,
    submittedHoursAgo: hoursAgo(oldest.toISOString(), now),
  };
}

export type FlagRow = { id: number; user_id: string; reason: string; created_at: string; window_start: string | null; window_end: string | null };

function manilaTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function flagRowToItem(row: FlagRow, username: string, expAtStake: number, now: Date): FlagItem {
  const detail =
    row.window_start && row.window_end
      ? `Between ${manilaTime(row.window_start)} and ${manilaTime(row.window_end)} (Asia/Manila time), confirmed well above the usual pace.`
      : "The exact times weren't recorded for this flag.";
  return {
    kind: "flag",
    id: `f-${row.id}`,
    username,
    pattern: row.reason,
    detail,
    expAtStake,
    submittedHoursAgo: hoursAgo(row.created_at, now),
  };
}
