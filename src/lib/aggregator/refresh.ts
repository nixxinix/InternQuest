import "server-only";
import { revalidateTag } from "next/cache";
import { RETENTION_DAYS } from "@/lib/retention";
import { createServiceSupabase } from "@/lib/supabase/server";
import { JSEARCH_HOST, JSEARCH_QUERIES, jsearchUrl, parseJsearch } from "./jsearch";
import { planImport, type ExistingListing } from "./plan";
import type { ImportedListing, ListingSourceAdapter, ParseResult } from "./types";

/** Aggregator listings not seen in the source for this long are hidden as dead (SPEC §5.3). */
export const STALE_DAYS = 14;

const merge = (a: ParseResult, b: ParseResult): ParseResult => {
  const skipped = { ...a.skipped };
  for (const [k, v] of Object.entries(b.skipped)) skipped[k] = (skipped[k] ?? 0) + v;
  return { listings: [...a.listings, ...b.listings], skipped };
};

/** JSearch on RapidAPI. Off unless JSEARCH_API_KEY is set (server only). */
export const jsearchAdapter: ListingSourceAdapter = {
  name: "jsearch",
  enabled: () => Boolean(process.env.JSEARCH_API_KEY),
  async fetchListings() {
    const key = process.env.JSEARCH_API_KEY!;
    let result: ParseResult = { listings: [], skipped: {} };
    for (const query of JSEARCH_QUERIES) {
      const res = await fetch(jsearchUrl(query), {
        headers: { "x-rapidapi-key": key, "x-rapidapi-host": JSEARCH_HOST },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(res.status === 429 ? "JSearch quota or rate limit reached (429)" : `JSearch answered ${res.status}`);
      }
      result = merge(result, parseJsearch(await res.json(), new Date()));
    }
    return result;
  },
};

type Admin = ReturnType<typeof createServiceSupabase>;

function row(l: ImportedListing, now: string) {
  return {
    title: l.title,
    company_name: l.company,
    source: l.source,
    source_ref: l.sourceRef,
    field_id: l.field,
    area: l.area,
    lat: l.lat,
    lng: l.lng,
    work_type: l.workType,
    snippet: l.snippet,
    apply_kind: "link",
    apply_url: l.applyUrl,
    apply_email: null,
    deadline: l.deadline,
    is_active: true,
    last_checked: now,
    dedupe_key: l.dedupeKey,
  };
}

async function setSkills(admin: Admin, listingId: string, skills: ImportedListing["skills"]) {
  await admin.from("internship_skills").delete().eq("internship_id", listingId);
  if (skills.length) {
    await admin.from("internship_skills").insert(skills.map((s) => ({ internship_id: listingId, skill_id: s.id, required: s.required })));
  }
}

async function existingFor(admin: Admin, listings: ImportedListing[]): Promise<ExistingListing[]> {
  if (!listings.length) return [];
  const cols = "id, source, source_ref, dedupe_key";
  const [byKey, byRef, byId] = await Promise.all([
    admin.from("internships").select(cols).in("dedupe_key", listings.map((l) => l.dedupeKey)),
    admin.from("internships").select(cols).eq("source", "jsearch").in("source_ref", listings.map((l) => l.sourceRef)),
    admin.from("internships").select(cols).in("id", listings.map((l) => l.id)),
  ]);
  const all = [...(byKey.data ?? []), ...(byRef.data ?? []), ...(byId.data ?? [])] as ExistingListing[];
  return [...new Map(all.map((e) => [e.id, e])).values()];
}

export type RefreshSummary = {
  source: string;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: Record<string, number>;
  expired: number;
  stale: number;
  /** Rows deleted by the retention clean-up, by kind. Empty if it didn't run. */
  purged: Record<string, number>;
  error: string | null;
};

/**
 * The daily job: import from each enabled source, then hide expired and
 * dead listings, then clear the listings cache. Every run is logged in
 * import_runs. A source failure (quota, outage) is logged, and the
 * clean-up still runs.
 */
export async function runDailyRefresh(adapter: ListingSourceAdapter = jsearchAdapter): Promise<RefreshSummary> {
  const admin = createServiceSupabase();
  const now = new Date().toISOString();
  const summary: RefreshSummary = { source: adapter.name, fetched: 0, inserted: 0, updated: 0, skipped: {}, expired: 0, stale: 0, purged: {}, error: null };
  const { data: run } = await admin.from("import_runs").insert({ source: adapter.name }).select("id").single<{ id: number }>();

  if (adapter.enabled()) {
    try {
      const parsed = await adapter.fetchListings();
      summary.fetched = parsed.listings.length + Object.values(parsed.skipped).reduce((a, b) => a + b, 0);
      summary.skipped = { ...parsed.skipped };
      const plan = planImport(parsed.listings, await existingFor(admin, parsed.listings));
      if (plan.skipped.directWins) summary.skipped["direct post wins"] = plan.skipped.directWins;
      if (plan.skipped.repeatInBatch) summary.skipped["repeat in this batch"] = plan.skipped.repeatInBatch;

      for (const l of plan.insert) {
        const { error } = await admin.from("internships").insert({ id: l.id, verified: false, moa: false, posted_at: l.postedAt, ...row(l, now) });
        if (error) {
          summary.skipped["database refused"] = (summary.skipped["database refused"] ?? 0) + 1;
          console.error("[refresh] insert failed:", l.id, error.message);
          continue;
        }
        await setSkills(admin, l.id, l.skills);
        summary.inserted += 1;
      }
      for (const { id, listing } of plan.update) {
        const { error } = await admin.from("internships").update(row(listing, now)).eq("id", id);
        if (error) {
          summary.skipped["database refused"] = (summary.skipped["database refused"] ?? 0) + 1;
          console.error("[refresh] update failed:", id, error.message);
          continue;
        }
        await setSkills(admin, id, listing.skills);
        summary.updated += 1;
      }
    } catch (e) {
      summary.error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      console.error("[refresh]", summary.error);
    }
  } else {
    summary.skipped["source off (no API key)"] = 1;
  }

  const { data: expiry, error: expiryError } = await admin.rpc("expire_listings", { p_stale_days: STALE_DAYS }).single<{ expired: number; stale: number }>();
  if (expiryError) summary.error = summary.error ?? `clean-up failed: ${expiryError.message}`.slice(0, 500);
  summary.expired = expiry?.expired ?? 0;
  summary.stale = expiry?.stale ?? 0;

  // Delete data past its retention period (0009_retention.sql). A failure is
  // logged and doesn't stop the run; tomorrow's run catches up.
  const { data: purged, error: purgeError } = await admin.rpc("purge_old_data", {
    p_click_days: RETENTION_DAYS.clicks,
    p_report_days: RETENTION_DAYS.reports,
    p_flag_days: RETENTION_DAYS.flags,
    p_audit_days: RETENTION_DAYS.audit,
    p_run_days: RETENTION_DAYS.runs,
  });
  if (purgeError) {
    console.error("[refresh] retention clean-up failed:", purgeError.message);
    summary.error = summary.error ?? `retention clean-up failed: ${purgeError.message}`.slice(0, 500);
  } else {
    summary.purged = purged as Record<string, number>;
  }

  if (run) {
    await admin
      .from("import_runs")
      .update({
        finished_at: new Date().toISOString(),
        fetched: summary.fetched,
        inserted: summary.inserted,
        updated: summary.updated,
        skipped: summary.skipped,
        expired: summary.expired,
        stale: summary.stale,
        error: summary.error,
      })
      .eq("id", run.id);
  }

  // New and hidden listings show up within the cache's next refresh.
  revalidateTag("listings", "max");
  return summary;
}
