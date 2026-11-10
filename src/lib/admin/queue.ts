/**
 * Admin queue (W14, USER_FLOWS §8). One screen, one decision per item, and
 * every action needs a reason and goes to the audit log (SPEC §14).
 * Pure, so the rules are tested; Phase 6 runs them in server actions behind
 * an admin role check.
 */

export type QueueKind = "company" | "report" | "flag";

export type CompanyItem = {
  kind: "company";
  id: string;
  name: string;
  email: string;
  website: string;
  role: string;
  registrationNo: string | null;
  submittedHoursAgo: number;
  emailConfirmed: boolean;
  websiteLoads: boolean;
  draftListings: number;
};

export type ReportItem = {
  kind: "report";
  id: string;
  listingTitle: string;
  company: string;
  snippet: string;
  reasons: { reason: ReportReason; count: number }[];
  notes: string[];
  submittedHoursAgo: number;
};

export type FlagItem = {
  kind: "flag";
  id: string;
  username: string;
  pattern: string;
  detail: string;
  expAtStake: number;
  submittedHoursAgo: number;
};

export type QueueItem = CompanyItem | ReportItem | FlagItem;

export type ReportReason = "payment" | "scam" | "closed" | "wrong" | "other";
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  payment: "Asks for payment or fees",
  scam: "Looks fake or like a scam",
  closed: "Closed or expired",
  wrong: "Wrong details",
  other: "Something else",
};

/** 3 or more "asks for payment" reports hide a listing automatically until an admin looks (USER_FLOWS §8.3). */
export const AUTO_HIDE_PAYMENT_REPORTS = 3;
export function isAutoHidden(r: ReportItem): boolean {
  return (r.reasons.find((x) => x.reason === "payment")?.count ?? 0) >= AUTO_HIDE_PAYMENT_REPORTS;
}
export function reportCount(r: ReportItem): number {
  return r.reasons.reduce((n, x) => n + x.count, 0);
}

/* ------------------------------------------------------------------------ */
/* Actions and reasons                                                       */
/* ------------------------------------------------------------------------ */

export type ActionDef = { id: string; label: string; tone: "primary" | "danger" | "secondary"; reasons: string[] };

/** Each action comes with a short list of reasons, so a decision is two taps and always explained. */
export const ACTIONS: Record<QueueKind, ActionDef[]> = {
  company: [
    { id: "approve", label: "Approve", tone: "primary", reasons: ["All checks passed", "Checked the website and registration myself"] },
    {
      id: "reject",
      label: "Reject",
      tone: "danger",
      reasons: [
        "Email domain doesn't match the website",
        "Website doesn't load or isn't a real business",
        "Not offering internships",
        "Duplicate of an existing company",
      ],
    },
  ],
  report: [
    { id: "hide", label: "Hide listing", tone: "danger", reasons: ["Asks for payment", "Scam or fake", "Closed or expired", "Wrong details"] },
    { id: "dismiss", label: "Dismiss", tone: "secondary", reasons: ["Listing looks fine", "Already fixed by the company", "Duplicate report"] },
    { id: "suspend", label: "Suspend company", tone: "danger", reasons: ["Asks interns for payment", "Repeated scam reports"] },
  ],
  flag: [
    { id: "clear", label: "Clear", tone: "secondary", reasons: ["Normal activity (e.g. a job fair day)", "Checked the click log"] },
    { id: "reverse", label: "Reverse EXP", tone: "danger", reasons: ["Confirmations without real applications", "Too fast to be real"] },
    { id: "suspend", label: "Suspend user", tone: "danger", reasons: ["Repeated abuse after a warning", "Automated activity"] },
  ],
};

export type AuditEntry = {
  at: string; // ISO
  admin: string;
  /** "import" is an admin CSV import (src/lib/admin/csvImport.ts), not a queue item. */
  kind: QueueKind | "import";
  itemId: string;
  subject: string;
  action: string;
  reason: string;
};

/** QueueItem ids combine every kind in one list (decide/nextItem look up by id alone), so report and flag ids carry a kind prefix; a company's id is its own uuid. */
export function reportItemInternshipId(itemId: string): string | null {
  return itemId.startsWith("r-") ? itemId.slice(2) : null;
}
export function flagItemRowId(itemId: string): number | null {
  if (!itemId.startsWith("f-")) return null;
  const n = Number(itemId.slice(2));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function subjectOf(item: QueueItem): string {
  if (item.kind === "company") return item.name;
  if (item.kind === "report") return `${item.listingTitle} (${item.company})`;
  return item.username;
}

export class DecisionError extends Error {}

/**
 * Applies a decision: the item leaves the queue and an audit entry is written.
 * Throws if the action doesn't exist for that kind or the reason is missing.
 */
export function decide(
  queue: QueueItem[],
  itemId: string,
  actionId: string,
  reason: string,
  admin: string,
  now: Date,
): { queue: QueueItem[]; entry: AuditEntry } {
  const item = queue.find((q) => q.id === itemId);
  if (!item) throw new DecisionError("That item was already decided.");
  const action = ACTIONS[item.kind].find((a) => a.id === actionId);
  if (!action) throw new DecisionError("Unknown action.");
  if (!reason.trim()) throw new DecisionError("Pick a reason. Every action is logged with one.");
  return {
    queue: queue.filter((q) => q.id !== itemId),
    entry: {
      at: now.toISOString(),
      admin,
      kind: item.kind,
      itemId,
      subject: subjectOf(item),
      action: action.label,
      reason: reason.trim(),
    },
  };
}

/** The item to open after one is decided: the next in the same tab, so reviewing is one long flow. */
export function nextItem(queue: QueueItem[], kind: QueueKind, decidedIndex: number): QueueItem | null {
  const same = queue.filter((q) => q.kind === kind);
  return same[Math.min(decidedIndex, same.length - 1)] ?? null;
}

/* ------------------------------------------------------------------------ */
/* Flagging unusual activity (SPEC §10 abuse prevention)                     */
/* ------------------------------------------------------------------------ */

/** Placeholder thresholds: tune with pilot data. */
export const BURST_MAX_CONFIRMS = 10;
export const BURST_WINDOW_MS = 60 * 60 * 1000;

/**
 * The largest number of application confirmations inside any one-hour window.
 * A server job flags users above BURST_MAX_CONFIRMS for review; nothing is
 * taken away automatically.
 */
export function maxConfirmsInWindow(times: number[], windowMs = BURST_WINDOW_MS): number {
  const t = [...times].sort((a, b) => a - b);
  let best = 0;
  let start = 0;
  for (let end = 0; end < t.length; end++) {
    while (t[end] - t[start] >= windowMs) start++;
    best = Math.max(best, end - start + 1);
  }
  return best;
}

export function shouldFlag(times: number[]): boolean {
  return maxConfirmsInWindow(times) > BURST_MAX_CONFIRMS;
}
