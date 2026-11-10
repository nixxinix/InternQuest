/**
 * Quest log entries and the rules for moving them (SPEC §5.6, §10).
 * Pure functions so they can be tested and reused by the server in Phase 2.
 *
 * EXP here is a PREVIEW of what the server will grant. The server is the only
 * place EXP is decided (exp_events, idempotent, daily caps). The client just
 * shows the amount the server returns.
 */
import { STATUSES, type Outcome, type Status } from "./status";

export type LogEntry = {
  id: string;
  /** null = added by hand from outside InternQuest (tracking only, no EXP: decision #18). */
  listingId: string | null;
  title: string;
  company: string;
  /** Only for entries added by hand: where the original posting is. */
  url: string | null;
  status: Status;
  outcome: Outcome | null;
  /** YYYY-MM-DD, Asia/Manila. */
  appliedOn: string | null;
  /** YYYY-MM-DDTHH:mm, Asia/Manila local time. */
  interviewAt: string | null;
  interviewHow: string;
  note: string;
  /** Apply was clicked but not confirmed yet (USER_FLOWS §3). */
  awaitingConfirm: boolean;
  /** Status steps that already earned EXP for this entry. Mirrors exp_events, so moving back and forth earns nothing. */
  rewarded: RewardKey[];
};

export type RewardKey = "confirm" | "applied" | "interview" | "result";

export const TITLE_MAX = 100;
export const COMPANY_MAX = 100;
export const URL_MAX = 500;
export const NOTE_MAX = 1000;
export const HOW_MAX = 80;

/* ------------------------------------------------------------------------ */
/* Dates (always Asia/Manila, SPEC §10)                                      */
/* ------------------------------------------------------------------------ */

const TZ = "Asia/Manila";

/** Today's date in Manila as YYYY-MM-DD. */
export function manilaDate(now: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** "Wed, Nov 12 · 10:00 AM" for a Manila local date-time. */
export function interviewText(at: string): string {
  const d = new Date(`${at}:00+08:00`);
  if (Number.isNaN(d.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
  return `${day} · ${time}`;
}

/** The short date line on a card. */
export function entryDateText(e: LogEntry, today: string): string | null {
  if (e.status === "interview" && e.interviewAt) return `Interview ${interviewText(e.interviewAt)}`;
  if (e.status === "saved") return null;
  if (!e.appliedOn) return null;
  if (e.appliedOn === today) return "Applied today";
  if (e.appliedOn === addDays(today, -1)) return "Applied yesterday";
  return `Applied ${shortDate(e.appliedOn)}`;
}

/* ------------------------------------------------------------------------ */
/* Moving                                                                    */
/* ------------------------------------------------------------------------ */

const rank = (s: Status) => STATUSES.indexOf(s);

export function moveEntry(e: LogEntry, to: Status, outcome: Outcome | null, today: string): LogEntry {
  return {
    ...e,
    status: to,
    outcome: to === "result" ? outcome : null,
    // Anything past Saved means they applied at some point; keep the first date we know.
    appliedOn: to === "saved" ? e.appliedOn : (e.appliedOn ?? today),
    awaitingConfirm: false,
  };
}

/** "Yes, I applied" on a card or sheet. */
export function confirmEntry(e: LogEntry, today: string): LogEntry {
  return { ...moveEntry(e, "applied", null, today), appliedOn: today };
}

export type ExpPreview = { amount: number; key: RewardKey } | null;

/**
 * What a move should earn (SPEC §10): +5 for a status update, +10 for logging
 * an offer or a rejection. Nothing for entries added by hand, for moving
 * backwards, or for a step this entry already earned (no farming by moving
 * a card back and forth).
 */
export function expForMove(e: LogEntry, to: Status, outcome: Outcome | null): ExpPreview {
  if (e.listingId === null) return null;
  if (to === "saved") return null;
  if (rank(to) < rank(e.status)) return null;
  if (to === e.status && to !== "result") return null;
  const key: RewardKey = to;
  if (e.rewarded.includes(key)) return null;
  if (to === "result") {
    return { amount: outcome === "offer" || outcome === "not_selected" ? 10 : 5, key };
  }
  return { amount: 5, key };
}

/** Confirming an application: +20 for the first 3 each day, then +5 (SPEC §10). */
export const CONFIRM_DAILY_FULL = 3;
export function expForConfirm(e: LogEntry, confirmedToday: number): ExpPreview {
  if (e.listingId === null || e.rewarded.includes("confirm")) return null;
  return { amount: confirmedToday < CONFIRM_DAILY_FULL ? 20 : 5, key: "confirm" };
}

/* ------------------------------------------------------------------------ */
/* Grouping and order                                                        */
/* ------------------------------------------------------------------------ */

export function groupByStatus(entries: LogEntry[]): Record<Status, LogEntry[]> {
  const out: Record<Status, LogEntry[]> = { saved: [], applied: [], interview: [], result: [] };
  for (const e of entries) out[e.status].push(e);
  return out;
}

/**
 * Most urgent first inside a column:
 * - Saved: "Did you apply?" first, then the soonest deadline.
 * - Applied: oldest first (the ones due a follow-up).
 * - Interview: soonest interview first.
 * - Result: most recent first.
 */
export function sortColumn(status: Status, entries: LogEntry[], deadlineOf: (e: LogEntry) => number | null): LogEntry[] {
  const inf = Number.POSITIVE_INFINITY;
  const copy = [...entries];
  switch (status) {
    case "saved":
      return copy.sort(
        (a, b) => Number(b.awaitingConfirm) - Number(a.awaitingConfirm) || (deadlineOf(a) ?? inf) - (deadlineOf(b) ?? inf),
      );
    case "applied":
      return copy.sort((a, b) => (a.appliedOn ?? "").localeCompare(b.appliedOn ?? ""));
    case "interview":
      return copy.sort((a, b) => (a.interviewAt ?? "9999").localeCompare(b.interviewAt ?? "9999"));
    case "result":
      return copy.sort((a, b) => (b.appliedOn ?? "").localeCompare(a.appliedOn ?? ""));
  }
}

/** The tab to open first on phones: where the most urgent next step is. */
export function defaultTab(entries: LogEntry[]): Status {
  if (entries.some((e) => e.awaitingConfirm)) return "saved";
  if (entries.some((e) => e.status === "interview")) return "interview";
  if (entries.some((e) => e.status === "applied")) return "applied";
  return "saved";
}

/* ------------------------------------------------------------------------ */
/* Adding one by hand                                                        */
/* ------------------------------------------------------------------------ */

export type ExternalDraft = {
  title: string;
  company: string;
  url: string;
  status: Exclude<Status, "result">;
  appliedOn: string;
};

export type ExternalErrors = Partial<Record<keyof ExternalDraft, string>>;

/** Only http(s) links, so a pasted "javascript:" link can never be stored or clicked. */
export function isSafeUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateExternal(d: ExternalDraft, today: string): ExternalErrors {
  const errors: ExternalErrors = {};
  const title = d.title.trim();
  const company = d.company.trim();
  const url = d.url.trim();
  if (!title) errors.title = "Add the role, like “Marketing OJT”.";
  else if (title.length > TITLE_MAX) errors.title = `Keep it under ${TITLE_MAX} characters.`;
  if (!company) errors.company = "Add the company or office name.";
  else if (company.length > COMPANY_MAX) errors.company = `Keep it under ${COMPANY_MAX} characters.`;
  if (url && (!isSafeUrl(url) || url.length > URL_MAX)) errors.url = "Paste the full link, starting with https://";
  if (d.status !== "saved" && d.appliedOn && d.appliedOn > today) errors.appliedOn = "That date hasn't happened yet.";
  return errors;
}

export function externalEntry(d: ExternalDraft, id: string, today: string): LogEntry {
  return {
    id,
    listingId: null,
    title: d.title.trim(),
    company: d.company.trim(),
    url: d.url.trim() || null,
    status: d.status,
    outcome: null,
    appliedOn: d.status === "saved" ? null : d.appliedOn || today,
    interviewAt: null,
    interviewHow: "",
    note: "",
    awaitingConfirm: false,
    rewarded: [],
  };
}
