/**
 * A company's listing draft (W13 post form, USER_FLOWS §7.6) and its rules.
 * Pure: the form, the live preview, and (Phase 6) the server use the same checks.
 */
import { findCityByName } from "@/lib/catalog/cities";
import { isFieldId, type FieldId } from "@/lib/catalog/fields";
import { canonicalSkill, skillName } from "@/lib/catalog/skills";
import { allowanceText, deadlineText } from "@/lib/listings/present";
import type { ListingSummary, WorkType } from "@/lib/listings/types";
import { scoreListing } from "@/lib/matching/score";
import { emailDomain } from "./email";

export const TITLE_MIN = 5;
export const TITLE_MAX = 80;
export const DESC_MIN = 50;
export const DESC_MAX = 2000;
export const MAX_POST_SKILLS = 10;
export const DEADLINE_MAX_DAYS = 180;

export type PostingDraft = {
  title: string;
  field: FieldId | "";
  description: string;
  skills: { id: string; required: boolean }[];
  /** A city from the list; not needed for remote listings. */
  city: string;
  /** Optional detail shown with the city, e.g. "Cubao". */
  area: string;
  workType: WorkType | "";
  allowance: { kind: "amount"; text: string } | { kind: "unpaid" };
  hours: string;
  moa: boolean;
  /** YYYY-MM-DD or "" */
  startDate: string;
  deadline: string;
  apply: { kind: "link"; url: string } | { kind: "email"; email: string };
};

export const EMPTY_DRAFT: PostingDraft = {
  title: "",
  field: "",
  description: "",
  skills: [],
  city: "",
  area: "",
  workType: "",
  allowance: { kind: "amount", text: "" },
  hours: "",
  moa: false,
  startDate: "",
  deadline: "",
  apply: { kind: "link", url: "" },
};

export type PostingErrors = Partial<Record<"title" | "field" | "description" | "skills" | "city" | "workType" | "allowance" | "hours" | "deadline" | "startDate" | "apply", string>>;

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * `companyEmail` is the verified work email: an application email must be on
 * the same domain, so a listing can't quietly send interns to a personal inbox
 * (a common scam pattern).
 */
export function validatePosting(d: PostingDraft, today: string, companyEmail: string): PostingErrors {
  const e: PostingErrors = {};
  const title = d.title.trim();
  if (title.length < TITLE_MIN) e.title = "Add a clear role title, like “IoT Firmware Intern”.";
  else if (title.length > TITLE_MAX) e.title = `Keep it under ${TITLE_MAX} characters.`;
  if (!isFieldId(d.field)) e.field = "Pick the closest field. It's how interns find you.";

  const desc = d.description.trim();
  if (desc.length < DESC_MIN) e.description = `Say what the intern will do, in at least ${DESC_MIN} characters.`;
  else if (desc.length > DESC_MAX) e.description = `Keep it under ${DESC_MAX} characters.`;

  if (!d.skills.some((s) => s.required)) e.skills = "Mark at least one skill as required.";
  else if (d.skills.length > MAX_POST_SKILLS) e.skills = `Up to ${MAX_POST_SKILLS} skills.`;

  if (!d.workType) e.workType = "Pick onsite, hybrid, or remote.";
  if (d.workType && d.workType !== "remote" && !findCityByName(d.city)) e.city = "Pick a city from the list.";

  if (d.allowance.kind === "amount") {
    const t = d.allowance.text.trim();
    if (!t) e.allowance = "Add the amount, like ₱500/day, or choose Unpaid.";
    else if (t.length > 40) e.allowance = "Keep it short, like ₱500/day.";
  }

  if (d.hours.trim()) {
    const n = Number(d.hours);
    if (!Number.isInteger(n) || n < 1 || n > 2000) e.hours = "Use a whole number of hours, like 486.";
  }

  if (d.deadline) {
    const days = dayDiff(today, d.deadline);
    if (Number.isNaN(days)) e.deadline = "Pick a date.";
    else if (days < 0) e.deadline = "The deadline has already passed.";
    else if (days > DEADLINE_MAX_DAYS) e.deadline = "Pick a date within the next 6 months.";
  }
  if (d.startDate && d.deadline && d.startDate < d.deadline) e.startDate = "The start date should be after the deadline.";

  if (d.apply.kind === "link") {
    if (!/^https:\/\/[^\s]+\.[^\s]+$/.test(d.apply.url.trim())) e.apply = "Paste the full link to your application page, starting with https://";
  } else {
    const dom = emailDomain(d.apply.email);
    const own = emailDomain(companyEmail);
    if (!dom) e.apply = "That doesn't look like an email address yet.";
    else if (own && dom !== own && !dom.endsWith(`.${own}`)) e.apply = `Use an address on your company's domain (@${own}).`;
  }
  return e;
}

/** For the checklist next to the form: what's done, in plain words. */
export function postingChecklist(d: PostingDraft, errors: PostingErrors): { label: string; done: boolean }[] {
  return [
    { label: "Title and field", done: !errors.title && !errors.field },
    { label: "What the intern will do", done: !errors.description },
    { label: `Skills (${d.skills.length})`, done: !errors.skills },
    { label: "Where and how", done: !errors.workType && !errors.city },
    { label: "Allowance and hours", done: !errors.allowance && !errors.hours },
    { label: "Deadline", done: Boolean(d.deadline) && !errors.deadline },
    { label: "How to apply", done: !errors.apply },
  ];
}

/**
 * The preview card. The match is shown for a typical applicant: someone in
 * this field who has the required skills but none of the nice-to-haves.
 */
export function draftPreview(d: PostingDraft, companyName: string, verified: boolean, today: string): ListingSummary {
  const city = findCityByName(d.city);
  const required = d.skills.filter((s) => s.required).map((s) => s.id);
  const workType: WorkType = d.workType || "onsite";
  const field = isFieldId(d.field) ? d.field : "iot";
  const match =
    d.skills.length > 0
      ? scoreListing(
          { skills: required, fields: [field], workType: null, location: null, radiusKm: 25 },
          { field, workType, location: null, skills: d.skills },
          canonicalSkill,
        )
      : null;
  const hours = d.hours.trim() && Number.isInteger(Number(d.hours)) ? Number(d.hours) : null;
  const days = d.deadline ? dayDiff(today, d.deadline) : null;

  return {
    id: "preview",
    title: d.title.trim() || "Your listing title",
    company: companyName,
    verified,
    area: workType === "remote" ? "Anywhere in the Philippines" : [d.area.trim(), city?.name].filter(Boolean).join(", ") || "City",
    distanceKm: null,
    workType,
    allowance: allowanceText(d.allowance.kind === "unpaid" ? "Unpaid" : d.allowance.text.trim() || null, hours),
    source: "direct",
    deadlineText: days !== null && !Number.isNaN(days) ? deadlineText(days) : null,
    postedText: "Posted today",
    skills: d.skills.filter((s) => s.required).map((s) => skillName(s.id)),
    match: match
      ? {
          pct: match.pct,
          matched: match.matched.map(skillName),
          missing: match.missing.filter((m) => m.required).map((m) => skillName(m.id)),
          missingNice: match.missing.filter((m) => !m.required).map((m) => skillName(m.id)),
        }
      : null,
  };
}
