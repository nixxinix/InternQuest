/**
 * Companies and their listings as the app uses them, mapped from database
 * rows. Pure (no Supabase imports), so the mapping and the draft-to-row
 * checks are unit tested. Server code loads the rows (src/lib/company/server.ts).
 */
import { findCityByName } from "@/lib/catalog/cities";
import { isFieldId } from "@/lib/catalog/fields";
import { isSkillId } from "@/lib/catalog/skills";
import { roundCoord } from "@/lib/account/account";
import { dedupeKey } from "@/lib/listings/dedupe";
import {
  emailDomain,
  isFreeEmail,
  validateRegistration,
  websiteHost,
  type CompanyRegistration,
  type RegistrationErrors,
} from "./email";
import { DESC_MAX, DESC_MIN, TITLE_MAX, TITLE_MIN, validatePosting, type PostingDraft } from "./posting";

export const COMPANY_TITLE_MIN = 3; // the database allows drafts from 3 characters (TITLE_MIN above is for publishing)

/* ------------------------------------------------------------------------ */
/* Company                                                                    */
/* ------------------------------------------------------------------------ */

export type CompanyStatus = "pending" | "approved" | "rejected" | "suspended";

export type CompanyRow = {
  id: string;
  name: string;
  website: string;
  work_email: string;
  role: string;
  registration_no: string | null;
  status: string;
  reject_reason: string | null;
  email_confirmed: boolean;
  website_loads: boolean | null;
  website_checked_at: string | null;
  created_at: string;
};

export type Company = {
  id: string;
  name: string;
  website: string;
  workEmail: string;
  role: string;
  registrationNo: string | null;
  status: CompanyStatus;
  rejectReason: string | null;
  emailConfirmed: boolean;
  websiteLoads: boolean | null;
  approved: boolean;
};

const STATUSES: CompanyStatus[] = ["pending", "approved", "rejected", "suspended"];

export function companyFromRow(row: CompanyRow): Company {
  const status = STATUSES.includes(row.status as CompanyStatus) ? (row.status as CompanyStatus) : "pending";
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    workEmail: row.work_email,
    role: row.role,
    registrationNo: row.registration_no,
    status,
    rejectReason: row.reject_reason,
    emailConfirmed: row.email_confirmed,
    websiteLoads: row.website_loads,
    approved: status === "approved",
  };
}

/** Registration input re-checked on the server, same rules as the form. */
export function validateRegistrationInput(r: unknown): RegistrationErrors | null {
  if (!r || typeof r !== "object") return { companyName: "Something's missing. Reload the page and try again." };
  const v = r as Partial<CompanyRegistration>;
  const reg: CompanyRegistration = {
    companyName: typeof v.companyName === "string" ? v.companyName : "",
    website: typeof v.website === "string" ? v.website : "",
    email: typeof v.email === "string" ? v.email : "",
    role: typeof v.role === "string" ? v.role : "",
    registrationNo: typeof v.registrationNo === "string" ? v.registrationNo : "",
    consent: v.consent === true,
  };
  const errors = validateRegistration(reg);
  return Object.keys(errors).length ? errors : null;
}

/* ------------------------------------------------------------------------ */
/* Listings owned by a company                                               */
/* ------------------------------------------------------------------------ */

export type PostingRow = {
  id: string;
  title: string;
  status: string;
  is_active: boolean;
  deadline: string | null;
  updated_at: string;
  created_at: string;
};

export type CompanyPostingStatus = "active" | "draft" | "closed";

export type CompanyPosting = {
  id: string;
  title: string;
  status: CompanyPostingStatus;
  applyClicks: number;
  deadlineInDays: number | null;
  updatedDaysAgo: number;
};

function daysBetween(from: string, to: string): number {
  const t = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((t(to) - t(from)) / 86_400_000);
}

export function postingFromRow(row: PostingRow, clicks: number, today: string): CompanyPosting {
  const status: CompanyPostingStatus = row.status === "draft" ? "draft" : row.is_active ? "active" : "closed";
  const updated = row.updated_at.slice(0, 10);
  return {
    id: row.id,
    title: row.title,
    status,
    applyClicks: clicks,
    deadlineInDays: status === "active" && row.deadline ? daysBetween(today, row.deadline) : null,
    updatedDaysAgo: Math.max(0, daysBetween(updated, today)),
  };
}

/* ------------------------------------------------------------------------ */
/* Draft -> database row                                                     */
/* ------------------------------------------------------------------------ */

export type PostingUpdate = {
  title: string;
  field_id: string | null;
  snippet: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  work_type: string | null;
  allowance: string | null;
  hours: number | null;
  moa: boolean;
  deadline: string | null;
  start_date: string | null;
  apply_kind: string | null;
  apply_url: string | null;
  apply_email: string | null;
};

/**
 * A draft needs only a title (3+ characters, matching the database). Every
 * other field is saved as given, even if incomplete; `validatePosting` is
 * the full check, run again at publish time (never trust the client).
 */
export function draftToRow(d: PostingDraft, today: string): PostingUpdate | string {
  const title = d.title.trim();
  if (title.length < COMPANY_TITLE_MIN) return `Add a title (at least ${COMPANY_TITLE_MIN} characters) before saving.`;
  if (title.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;

  const desc = d.description.trim();
  if (desc.length > DESC_MAX) return `Keep the description under ${DESC_MAX} characters.`;

  if (!d.skills.every((s) => typeof s.id === "string" && isSkillId(s.id))) return "One of those skills isn't on our list.";
  if (d.skills.length > 10) return "Up to 10 skills.";

  const field = isFieldId(d.field) ? d.field : null;
  const city = d.workType !== "remote" ? findCityByName(d.city) : null;
  const workType = d.workType === "onsite" || d.workType === "hybrid" || d.workType === "remote" ? d.workType : null;

  const hours = d.hours.trim() ? Number(d.hours) : null;
  if (hours !== null && (!Number.isInteger(hours) || hours < 1 || hours > 2000)) return "Use a whole number of OJT hours.";

  if (d.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)) return "Pick a deadline date.";
  if (d.deadline && d.deadline < today) return "The deadline has already passed.";
  if (d.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.startDate)) return "Pick a start date.";
  if (d.startDate && d.deadline && d.startDate < d.deadline) return "The start date should be after the deadline.";

  let apply_kind: string | null = null;
  let apply_url: string | null = null;
  let apply_email: string | null = null;
  if (d.apply.kind === "link" && d.apply.url.trim()) {
    if (!/^https:\/\/[^\s]+\.[^\s]+$/.test(d.apply.url.trim())) return "The application link must start with https://";
    apply_kind = "link";
    apply_url = d.apply.url.trim().slice(0, 500);
  } else if (d.apply.kind === "email" && d.apply.email.trim()) {
    if (!emailDomain(d.apply.email)) return "That application email doesn't look right.";
    apply_kind = "email";
    apply_email = d.apply.email.trim().slice(0, 254);
  }

  return {
    title: title.slice(0, TITLE_MAX),
    field_id: field,
    snippet: desc ? desc.slice(0, 600) : null,
    area: d.area.trim() ? d.area.trim().slice(0, 120) : (city?.name ?? null),
    lat: city ? roundCoord(city.lat) : null,
    lng: city ? roundCoord(city.lng) : null,
    work_type: workType,
    allowance: d.allowance.kind === "unpaid" ? "Unpaid" : d.allowance.text.trim() ? d.allowance.text.trim().slice(0, 60) : null,
    hours,
    moa: d.moa,
    deadline: d.deadline || null,
    start_date: d.startDate || null,
    apply_kind,
    apply_url,
    apply_email,
  };
}

/* ------------------------------------------------------------------------ */
/* Is a draft ready to publish? Checked against the stored row (never the    */
/* client), so this is the real gate — PostForm's live checklist is a       */
/* preview of the same rules, not the enforcement.                          */
/* ------------------------------------------------------------------------ */

export type StoredPosting = {
  title: string;
  field_id: string | null;
  snippet: string | null;
  area: string | null;
  work_type: string | null;
  apply_kind: string | null;
  apply_url: string | null;
  apply_email: string | null;
};

export function publishErrors(row: StoredPosting, companyEmail: string): string[] {
  const errors: string[] = [];
  const title = row.title.trim();
  if (title.length < TITLE_MIN) errors.push(`Add a clearer title (at least ${TITLE_MIN} characters).`);
  if (!row.field_id || !isFieldId(row.field_id)) errors.push("Pick the field this role is in.");
  if (!row.snippet || row.snippet.trim().length < DESC_MIN) errors.push(`Describe what the intern will do (at least ${DESC_MIN} characters).`);
  if (!row.work_type) errors.push("Pick onsite, hybrid, or remote.");
  if (row.work_type && row.work_type !== "remote" && !row.area?.trim()) errors.push("Add a city.");
  if (!row.apply_kind) errors.push("Add how interns should apply.");
  if (row.apply_kind === "email") {
    const dom = emailDomain(row.apply_email ?? "");
    const own = emailDomain(companyEmail);
    if (!dom) errors.push("The application email isn't valid.");
    else if (own && dom !== own && !dom.endsWith(`.${own}`)) errors.push(`Use an application email on your own domain (@${own}).`);
  } else if (row.apply_kind === "link" && !/^https:\/\/[^\s]+\.[^\s]+$/.test(row.apply_url ?? "")) {
    errors.push("The application link must start with https://");
  }
  return errors;
}

export type EditablePostingRow = {
  title: string;
  field_id: string | null;
  snippet: string | null;
  area: string | null;
  work_type: string | null;
  allowance: string | null;
  hours: number | null;
  moa: boolean;
  deadline: string | null;
  start_date: string | null;
  apply_kind: string | null;
  apply_url: string | null;
  apply_email: string | null;
  internship_skills: { skill_id: string; required: boolean }[] | null;
};

/**
 * The database row as the edit form's starting point. The city dropdown's
 * own value isn't kept as a separate column (only the saved `area` text and
 * its location are), so a saved city reopens in the free-text "Area" box
 * instead of pre-selecting the dropdown; typing the city name there again
 * re-matches it the same way a first-time entry would.
 */
export function rowToDraft(row: EditablePostingRow): PostingDraft {
  const skills = (row.internship_skills ?? []).filter((s) => isSkillId(s.skill_id)).map((s) => ({ id: s.skill_id, required: s.required }));
  return {
    title: row.title,
    field: isFieldId(row.field_id) ? row.field_id : "",
    description: row.snippet ?? "",
    skills,
    city: "",
    area: row.area ?? "",
    workType: row.work_type === "onsite" || row.work_type === "hybrid" || row.work_type === "remote" ? row.work_type : "",
    allowance: row.allowance === "Unpaid" ? { kind: "unpaid" } : { kind: "amount", text: row.allowance ?? "" },
    hours: row.hours !== null ? String(row.hours) : "",
    moa: row.moa,
    startDate: row.start_date ?? "",
    deadline: row.deadline ?? "",
    apply: row.apply_kind === "email" ? { kind: "email", email: row.apply_email ?? "" } : { kind: "link", url: row.apply_url ?? "" },
  };
}

/** The real dedupe key, computed when a draft is published (drafts use a placeholder instead). */
export function publishDedupeKey(companyName: string, title: string, area: string | null, remote: boolean): string {
  return dedupeKey(companyName, title, remote ? "remote" : (area ?? ""));
}

export { TITLE_MIN, TITLE_MAX, DESC_MIN, DESC_MAX, isFreeEmail, websiteHost, validatePosting };
export type { PostingDraft };
