/**
 * Admin CSV import (SPEC §5.3: "Manual entries imported by admin (CSV)").
 * Pure and unit tested; src/app/actions/adminImport.ts checks admin
 * membership, previews, and writes.
 *
 * One row per listing. Required columns: title, company, field, city,
 * work_type, description, apply. Optional: deadline, allowance, hours, moa,
 * skills. Header names ignore case, spaces, and underscores. A row with any
 * error is left out (and shown), never half-imported.
 */
import { findCatalogCity } from "@/lib/catalog/cities";
import { FIELDS, type FieldId } from "@/lib/catalog/fields";
import { SKILLS } from "@/lib/catalog/skills";
import { dedupeKey } from "@/lib/listings/dedupe";
import type { WorkType } from "@/lib/listings/types";
import { listingId, makeSnippet, safeApplyUrl } from "@/lib/aggregator/normalize";

export const CSV_MAX_ROWS = 500;
export const CSV_MAX_BYTES = 1_000_000;
/** Admin-written text is ours, so it may be longer than an aggregator snippet; the database caps it at 600. */
export const ADMIN_SNIPPET_MAX = 600;

export const CSV_COLUMNS = {
  required: ["title", "company", "field", "city", "work_type", "description", "apply"],
  optional: ["deadline", "allowance", "hours", "moa", "skills"],
} as const;

export const CSV_TEMPLATE =
  "title,company,field,city,work_type,description,apply,deadline,allowance,hours,moa,skills\n" +
  '"Data Encoder Intern","Kalye Logistics Inc.","Data & Analytics","Pasig","onsite","Help clean and enter delivery data in spreadsheets. You will learn how a logistics team tracks shipments.","https://kalye.example.com/careers","2026-12-15","PHP 300/day","486","yes","Excel*; SQL"\n';

/* ------------------------------------------------------------------------ */
/* Parsing                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * RFC 4180 CSV: quoted fields with commas, newlines, and "" for a quote.
 * Handles a UTF-8 BOM and CRLF (Excel's defaults). Returns rows of cells.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Blank lines (often at the end) aren't rows.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const headerKey = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, "_");

/* ------------------------------------------------------------------------ */
/* Cell rules                                                                 */
/* ------------------------------------------------------------------------ */

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** By id ("data"), label ("Data & Analytics"), or short label ("Data"). */
export function parseField(value: string): FieldId | null {
  const v = norm(value);
  return FIELDS.find((f) => f.id === v || norm(f.label) === v || norm(f.short) === v)?.id ?? null;
}

const WORK_TYPES: Record<string, WorkType> = {
  onsite: "onsite",
  "on-site": "onsite",
  "on site": "onsite",
  hybrid: "hybrid",
  remote: "remote",
  "work from home": "remote",
  wfh: "remote",
};

/** "Excel*; SQL": by name, id, or alias. A trailing * marks it required. Unknown names are reported, not guessed. */
export function parseSkills(value: string): { skills: { id: string; required: boolean }[]; unknown: string[] } {
  const skills: { id: string; required: boolean }[] = [];
  const unknown: string[] = [];
  for (const raw of value.split(/[;|]/)) {
    const part = raw.trim();
    if (!part) continue;
    const required = part.endsWith("*");
    const name = norm(part.replace(/\*+$/, ""));
    const skill = SKILLS.find((s) => s.id === name || norm(s.name) === name || (s.aliases ?? []).some((a) => norm(a) === name));
    if (!skill) unknown.push(part.replace(/\*+$/, "").trim());
    else if (!skills.some((s) => s.id === skill.id)) skills.push({ id: skill.id, required });
  }
  return { skills: skills.slice(0, 12), unknown };
}

const YES = new Set(["yes", "y", "true", "1"]);
const NO = new Set(["no", "n", "false", "0", ""]);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ------------------------------------------------------------------------ */
/* Rows                                                                       */
/* ------------------------------------------------------------------------ */

export type AdminListing = {
  id: string;
  title: string;
  company: string;
  field: FieldId;
  area: string;
  lat: number | null;
  lng: number | null;
  workType: WorkType;
  snippet: string;
  apply: { kind: "link"; url: string } | { kind: "email"; email: string };
  deadline: string | null;
  allowance: string | null;
  hours: number | null;
  moa: boolean;
  skills: { id: string; required: boolean }[];
  dedupeKey: string;
};

export type CsvRow = {
  /** The line number in the file, counting the header as line 1. */
  line: number;
  title: string;
  company: string;
  listing: AdminListing | null;
  errors: string[];
  warnings: string[];
};

export type CsvParseResult = { rows: CsvRow[]; fileError: string | null };

export function parseAdminCsv(text: string, today: string): CsvParseResult {
  if (text.length > CSV_MAX_BYTES) return { rows: [], fileError: "That file is over 1 MB. Split it into smaller files." };
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [], fileError: "The file needs a header row and at least one listing." };

  const headers = grid[0].map(headerKey);
  const missing = CSV_COLUMNS.required.filter((c) => !headers.includes(c));
  if (missing.length) return { rows: [], fileError: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template to see them all.` };
  if (grid.length - 1 > CSV_MAX_ROWS) return { rows: [], fileError: `That's ${grid.length - 1} rows. Import at most ${CSV_MAX_ROWS} at a time.` };

  const at = (cells: string[], col: string) => (cells[headers.indexOf(col)] ?? "").trim();
  const seen = new Set<string>();

  const rows = grid.slice(1).map((cells, i): CsvRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const title = at(cells, "title").replace(/\s+/g, " ");
    const company = at(cells, "company").replace(/\s+/g, " ");

    if (title.length < 3 || title.length > 120) errors.push("Title must be 3 to 120 characters.");
    if (!company || company.length > 120) errors.push("Add the company (up to 120 characters).");

    const field = parseField(at(cells, "field"));
    if (!field) errors.push(`Field "${at(cells, "field")}" isn't one of ours. Use one like "${FIELDS[2].label}".`);

    const workType = WORK_TYPES[norm(at(cells, "work_type"))] ?? null;
    if (!workType) errors.push("Work type must be onsite, hybrid, or remote.");

    const cityText = at(cells, "city");
    const city = cityText ? findCatalogCity(cityText) : null;
    let area = cityText.slice(0, 120);
    if (!cityText) {
      if (workType === "remote") area = "Anywhere in the Philippines";
      else errors.push("Add a city (or set work type to remote).");
    } else if (!city && workType !== "remote") {
      warnings.push(`"${cityText}" isn't on our city list, so distance can't be shown for it.`);
    }

    const description = at(cells, "description");
    const snippet = makeSnippet(description, ADMIN_SNIPPET_MAX);
    if (snippet.length < 40) errors.push("Description must be at least 40 characters.");

    const applyText = at(cells, "apply");
    let apply: AdminListing["apply"] | null = null;
    if (EMAIL.test(applyText)) apply = { kind: "email", email: applyText.toLowerCase() };
    else {
      const url = safeApplyUrl(applyText);
      if (url) apply = { kind: "link", url };
      else errors.push("Apply must be an https:// link or an email address.");
    }

    const deadlineText = at(cells, "deadline");
    let deadline: string | null = null;
    if (deadlineText) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineText) || Number.isNaN(Date.parse(deadlineText))) errors.push("Deadline must look like 2026-12-15.");
      else if (deadlineText < today) errors.push("The deadline has already passed.");
      else deadline = deadlineText;
    }

    const hoursText = at(cells, "hours").replace(/[, ]|hours?|hrs?/gi, "");
    let hours: number | null = null;
    if (hoursText) {
      const n = Number(hoursText);
      if (!Number.isInteger(n) || n < 1 || n > 2000) errors.push("Hours must be a whole number from 1 to 2000.");
      else hours = n;
    }

    const moaText = norm(at(cells, "moa"));
    if (!YES.has(moaText) && !NO.has(moaText)) errors.push("MOA must be yes or no.");

    const allowance = at(cells, "allowance").slice(0, 60) || null;

    const { skills, unknown } = parseSkills(at(cells, "skills"));
    if (unknown.length) warnings.push(`Skipped skills we don't know: ${unknown.join(", ")}.`);
    if (!skills.length) warnings.push("No skills, so the match score will rely on field and distance only.");

    const key = dedupeKey(company, title, workType === "remote" ? "remote" : area);
    if (!errors.length && seen.has(key)) errors.push("Same company, title, and city as an earlier row in this file.");
    seen.add(key);

    const listing: AdminListing | null =
      errors.length || !field || !workType || !apply
        ? null
        : {
            id: listingId("ad", company, title, key),
            title,
            company,
            field,
            area,
            lat: workType === "remote" ? null : (city?.lat ?? null),
            lng: workType === "remote" ? null : (city?.lng ?? null),
            workType,
            snippet,
            apply,
            deadline,
            allowance,
            hours,
            moa: YES.has(moaText),
            skills,
            dedupeKey: key,
          };
    return { line: i + 2, title, company, listing, errors, warnings };
  });

  return { rows, fileError: null };
}

/* ------------------------------------------------------------------------ */
/* What happens to each valid row                                            */
/* ------------------------------------------------------------------------ */

export type ExistingByKey = { id: string; source: string; dedupe_key: string };
export type RowOutcome = "new" | "update" | "replaces-aggregator" | "company-post-wins";

/**
 * Same rule as the daily import (decision #130), with admin above aggregators:
 * a company's own post is never touched; an earlier admin entry is updated in
 * place (so re-importing a fixed file corrects it); an aggregator copy is
 * hidden and replaced.
 */
export function rowOutcome(existing: ExistingByKey | undefined): RowOutcome {
  if (!existing) return "new";
  if (existing.source === "direct") return "company-post-wins";
  if (existing.source === "admin") return "update";
  return "replaces-aggregator";
}
