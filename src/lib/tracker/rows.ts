/**
 * Quest log rows (public.applications) to and from the app's LogEntry.
 * Pure, so the server actions' rules are unit tested.
 */
import { NOTE_MAX, HOW_MAX, interviewText, type LogEntry } from "./log";
import { OUTCOMES, STATUSES, type Outcome, type Status } from "./status";

/** "Did you apply?" is asked, and a "Yes" is accepted, within this many days of the Apply click. */
export const CONFIRM_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

export type ApplicationRow = {
  id: string;
  internship_id: string | null;
  title: string;
  company: string;
  url: string | null;
  status: string;
  outcome: string | null;
  /** "YYYY-MM-DD" */
  applied_on: string | null;
  interview_at: string | null;
  interview_how: string;
  note: string;
  last_clicked_at: string | null;
  prompt_dismissed_at: string | null;
  confirmed_at: string | null;
  updated_at: string;
};

export const APPLICATION_COLUMNS =
  "id, internship_id, title, company, url, status, outcome, applied_on, interview_at, interview_how, note, last_clicked_at, prompt_dismissed_at, confirmed_at, updated_at";

export const isStatus = (s: unknown): s is Status => typeof s === "string" && (STATUSES as readonly string[]).includes(s);
export const isOutcome = (o: unknown): o is Outcome => typeof o === "string" && (OUTCOMES as readonly string[]).includes(o);

/** "2026-11-12T10:00" (Manila local, as the form uses it) from a stored timestamp. */
export function manilaLocal(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** The other way: a Manila local date-time as a timestamp, or null if it isn't one. */
export function fromManilaLocal(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The "Did you apply?" question shows for a saved listing clicked recently and not yet answered. */
export function isAwaitingConfirm(row: ApplicationRow, now: Date): boolean {
  if (row.status !== "saved" || row.confirmed_at || !row.last_clicked_at || !row.internship_id) return false;
  const clicked = new Date(row.last_clicked_at).getTime();
  if (now.getTime() - clicked > CONFIRM_WINDOW_DAYS * DAY_MS) return false;
  return !row.prompt_dismissed_at || new Date(row.prompt_dismissed_at).getTime() < clicked;
}

export function entryFromRow(row: ApplicationRow, now: Date): LogEntry {
  const status = isStatus(row.status) ? row.status : "saved";
  return {
    id: row.id,
    listingId: row.internship_id,
    title: row.title,
    company: row.company,
    url: row.internship_id ? null : row.url,
    status,
    outcome: status === "result" && isOutcome(row.outcome) ? row.outcome : null,
    appliedOn: row.applied_on ? String(row.applied_on).slice(0, 10) : null,
    interviewAt: row.interview_at ? manilaLocal(row.interview_at) : null,
    interviewHow: row.interview_how,
    note: row.note,
    awaitingConfirm: isAwaitingConfirm(row, now),
    // EXP steps arrive with exp_events in Phase 3.
    rewarded: [],
  };
}

export type QuestSummary = {
  /** The newest listing still waiting for "Did you apply?" (Home asks about it). */
  pendingConfirm: string | null;
  /** Applications confirmed with "Yes, I applied" (share card, leaderboard). */
  confirmedCount: number;
  /** Interviews from today on, soonest first. */
  upcoming: { listingId: string; company: string; what: string; when: string; how: string }[];
};

export function summarize(rows: ApplicationRow[], now: Date): QuestSummary {
  const waiting = rows
    .filter((r) => isAwaitingConfirm(r, now))
    .sort((a, b) => (b.last_clicked_at ?? "").localeCompare(a.last_clicked_at ?? ""));
  const upcoming = rows
    .filter((r) => r.status === "interview" && r.interview_at && new Date(r.interview_at).getTime() >= now.getTime() - 2 * 3_600_000)
    .sort((a, b) => (a.interview_at ?? "").localeCompare(b.interview_at ?? ""))
    .map((r) => ({
      listingId: r.internship_id ?? "",
      company: r.company,
      what: "Interview",
      when: interviewText(manilaLocal(r.interview_at!) ?? ""),
      how: r.interview_how,
    }));
  return {
    pendingConfirm: waiting[0]?.internship_id ?? null,
    confirmedCount: rows.filter((r) => r.confirmed_at).length,
    upcoming,
  };
}

/* ------------------------------------------------------------------------ */
/* Checks for the server actions                                             */
/* ------------------------------------------------------------------------ */

export type DetailsUpdate = { note: string; interview_at: string | null; interview_how: string };

/** Notes and interview details from the card's details sheet. */
export function validateDetails(patch: unknown): DetailsUpdate | string {
  if (!patch || typeof patch !== "object") return "Something's missing. Reload the page and try again.";
  const p = patch as Record<string, unknown>;
  const note = typeof p.note === "string" ? p.note.trim() : "";
  const how = typeof p.interviewHow === "string" ? p.interviewHow.trim() : "";
  if (note.length > NOTE_MAX) return `Keep notes under ${NOTE_MAX} characters.`;
  if (how.length > HOW_MAX) return `Keep it under ${HOW_MAX} characters.`;
  let at: string | null = null;
  if (p.interviewAt !== null && p.interviewAt !== undefined && p.interviewAt !== "") {
    at = typeof p.interviewAt === "string" ? fromManilaLocal(p.interviewAt) : null;
    if (!at) return "Pick a date and time for the interview.";
  }
  return { note, interview_at: at, interview_how: how };
}

/**
 * Moving a card (same rules as moveEntry in log.ts): an outcome only for
 * Result, and the first applied date is kept once anything passes Saved.
 */
export function moveUpdate(
  current: { status: string; applied_on: string | null },
  to: unknown,
  outcome: unknown,
  today: string,
): { status: Status; outcome: Outcome | null; applied_on: string | null } | string {
  if (!isStatus(to)) return "Pick a column from the list.";
  if (outcome !== null && outcome !== undefined && !isOutcome(outcome)) return "Pick a result from the list.";
  return {
    status: to,
    outcome: to === "result" && isOutcome(outcome) ? outcome : null,
    applied_on: to === "saved" ? current.applied_on : (current.applied_on ?? today),
  };
}
