"use server";

/**
 * Admin CSV import (SPEC §5.3). Preview first, then import. Both steps
 * re-check admin membership and re-parse the file on the server: the import
 * never trusts what the preview showed the browser.
 */
import { revalidateTag } from "next/cache";
import { currentAdmin, writeAudit } from "@/lib/admin/server";
import { parseAdminCsv, rowOutcome, type AdminListing, type ExistingByKey, type RowOutcome } from "@/lib/admin/csvImport";
import { createServiceSupabase } from "@/lib/supabase/server";
import { manilaDate } from "@/lib/tracker/log";
import type { ActionResult } from "./auth";

export type ImportPreviewRow = {
  line: number;
  title: string;
  company: string;
  outcome: RowOutcome | "error";
  errors: string[];
  warnings: string[];
};

export type ImportCounts = { new: number; update: number; replaces: number; skipped: number; errors: number };

type Analysis = { rows: (ImportPreviewRow & { listing: AdminListing | null; existing?: ExistingByKey })[]; counts: ImportCounts };

const fail = (error: string) => ({ ok: false as const, error });
const NOT_ADMIN = "You need an admin account for this.";

async function analyze(text: string): Promise<Analysis | string> {
  if (typeof text !== "string" || !text.trim()) return "Choose a CSV file first.";
  const parsed = parseAdminCsv(text, manilaDate(new Date()));
  if (parsed.fileError) return parsed.fileError;

  const keys = parsed.rows.flatMap((r) => (r.listing ? [r.listing.dedupeKey] : []));
  const existing = new Map<string, ExistingByKey>();
  const admin = createServiceSupabase();
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await admin.from("internships").select("id, source, dedupe_key").in("dedupe_key", keys.slice(i, i + 200));
    if (error) return "Couldn't check for existing listings. Try again.";
    for (const e of (data ?? []) as ExistingByKey[]) existing.set(e.dedupe_key, e);
  }

  const counts: ImportCounts = { new: 0, update: 0, replaces: 0, skipped: 0, errors: 0 };
  const rows = parsed.rows.map((r) => {
    const found = r.listing ? existing.get(r.listing.dedupeKey) : undefined;
    const outcome: ImportPreviewRow["outcome"] = r.listing ? rowOutcome(found) : "error";
    if (outcome === "error") counts.errors += 1;
    else if (outcome === "new") counts.new += 1;
    else if (outcome === "update") counts.update += 1;
    else if (outcome === "replaces-aggregator") counts.replaces += 1;
    else counts.skipped += 1;
    return { line: r.line, title: r.title, company: r.company, outcome, errors: r.errors, warnings: r.warnings, listing: r.listing, existing: found };
  });
  return { rows, counts };
}

export async function previewCsvImport(text: string): Promise<ActionResult<{ rows: ImportPreviewRow[]; counts: ImportCounts }>> {
  if (!(await currentAdmin())) return fail(NOT_ADMIN);
  const result = await analyze(text);
  if (typeof result === "string") return fail(result);
  // Only what the preview shows goes to the browser.
  const rows = result.rows.map((r): ImportPreviewRow => ({
    line: r.line,
    title: r.title,
    company: r.company,
    outcome: r.outcome,
    errors: r.errors,
    warnings: r.warnings,
  }));
  return { ok: true, rows, counts: result.counts };
}

function columns(l: AdminListing, now: string) {
  return {
    title: l.title,
    company_name: l.company,
    verified: false,
    source: "admin",
    source_ref: null,
    field_id: l.field,
    area: l.area,
    lat: l.lat,
    lng: l.lng,
    work_type: l.workType,
    allowance: l.allowance,
    hours: l.hours,
    moa: l.moa,
    deadline: l.deadline,
    snippet: l.snippet,
    apply_kind: l.apply.kind,
    apply_url: l.apply.kind === "link" ? l.apply.url : null,
    apply_email: l.apply.kind === "email" ? l.apply.email : null,
    status: "published",
    is_active: true,
    last_checked: now,
    dedupe_key: l.dedupeKey,
  };
}

export async function runCsvImport(text: string, fileName: string): Promise<ActionResult<{ counts: ImportCounts; failed: number }>> {
  const me = await currentAdmin();
  if (!me) return fail(NOT_ADMIN);
  const result = await analyze(text);
  if (typeof result === "string") return fail(result);

  const db = createServiceSupabase();
  const now = new Date().toISOString();
  let failed = 0;

  for (const row of result.rows) {
    const l = row.listing;
    if (!l || row.outcome === "error" || row.outcome === "company-post-wins") continue;

    let id = l.id;
    if (row.outcome === "update" && row.existing) {
      id = row.existing.id;
      const { error } = await db.from("internships").update(columns(l, now)).eq("id", id);
      if (error) {
        console.error("[runCsvImport] update failed:", id, error.message);
        failed += 1;
        continue;
      }
    } else {
      if (row.outcome === "replaces-aggregator" && row.existing) {
        // Same rule as a company's own post (decision #137): hide the aggregator copy and free its key.
        await db.from("internships").update({ is_active: false, dedupe_key: `superseded:${row.existing.id}` }).eq("id", row.existing.id);
      }
      const { error } = await db.from("internships").insert({ id, posted_at: now, ...columns(l, now) });
      if (error) {
        console.error("[runCsvImport] insert failed:", id, error.message);
        failed += 1;
        continue;
      }
    }

    await db.from("internship_skills").delete().eq("internship_id", id);
    if (l.skills.length) {
      await db.from("internship_skills").insert(l.skills.map((s) => ({ internship_id: id, skill_id: s.id, required: s.required })));
    }
  }

  const c = result.counts;
  const done = c.new + c.update + c.replaces - failed;
  await writeAudit(me, {
    kind: "import",
    itemId: `csv-${now}`.slice(0, 100),
    subject: `${String(fileName || "CSV file").slice(0, 120)} (${done} listings)`,
    action: "Imported listings",
    reason: `${c.new + c.replaces} new, ${c.update} updated, ${c.skipped} left to the company's own post, ${c.errors + failed} not imported`,
  });
  revalidateTag("listings", "max");
  return { ok: true, counts: c, failed };
}
