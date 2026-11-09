"use server";

/**
 * Quest log server actions (SPEC §5.6, §5.7). Everything runs as the
 * signed-in user, so row-level security keeps each log private, except
 * "Yes, I applied": the server records it (confirmed_at) only after finding
 * this user's Apply click on that listing in the last 14 days.
 * EXP for these steps arrives with Phase 3 (exp_events).
 */
import { TOO_MANY_TRIES } from "@/lib/auth/limits";
import { currentUserId, takeRateLimit } from "@/lib/auth/server";
import { getListing } from "@/lib/listings/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { manilaDate, validateExternal, type ExternalDraft, type LogEntry } from "@/lib/tracker/log";
import {
  APPLICATION_COLUMNS,
  CONFIRM_WINDOW_DAYS,
  entryFromRow,
  isStatus,
  moveUpdate,
  validateDetails,
  type ApplicationRow,
} from "@/lib/tracker/rows";
import type { ActionResult } from "./auth";

const NOT_CONNECTED = "Accounts aren't connected in this preview yet.";
const NOT_SIGNED_IN = "You're signed out. Log in again, then retry.";
const SOMETHING_WRONG = "Couldn't save that. Check your connection and try again.";
const NOT_FOUND = "That entry isn't in your quest log any more. Reload the page.";

const fail = (error: string) => ({ ok: false as const, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Me = { id: string; supabase: Awaited<ReturnType<typeof createServerSupabase>> };

/** Signed in, connected, and under the change limit. */
async function me(): Promise<Me | string> {
  if (!isSupabaseConfigured()) return NOT_CONNECTED;
  const id = await currentUserId();
  if (!id) return NOT_SIGNED_IN;
  if (!(await takeRateLimit("questLog", id))) return TOO_MANY_TRIES;
  return { id, supabase: await createServerSupabase() };
}

async function readEntry(m: Me, entryId: string): Promise<ApplicationRow | null> {
  if (!UUID.test(entryId)) return null;
  const { data } = await m.supabase.from("applications").select(APPLICATION_COLUMNS).eq("id", entryId).maybeSingle<ApplicationRow>();
  return data;
}

/* ------------------------------------------------------------------------ */
/* Listings: save, unsave, confirm                                           */
/* ------------------------------------------------------------------------ */

/** Save a listing to the quest log (Saved column). Saving twice is fine. */
export async function saveListing(listingId: string): Promise<ActionResult<{ entry: LogEntry }>> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  const listing = await getListing(String(listingId ?? ""));
  if (!listing) return fail("That listing isn't available any more.");

  const existing = await m.supabase
    .from("applications")
    .select(APPLICATION_COLUMNS)
    .eq("user_id", m.id)
    .eq("internship_id", listing.id)
    .maybeSingle<ApplicationRow>();
  if (existing.data) return { ok: true, entry: entryFromRow(existing.data, new Date()) };

  const { data, error } = await m.supabase
    .from("applications")
    .insert({ internship_id: listing.id, title: listing.title.slice(0, 100), company: listing.company.slice(0, 100), status: "saved" })
    .select(APPLICATION_COLUMNS)
    .single<ApplicationRow>();
  if (error || !data) {
    console.error("[saveListing]", error?.message);
    return fail(error?.message.includes("at most 500") ? "Your quest log is full (500 entries). Remove some old ones first." : SOMETHING_WRONG);
  }
  return { ok: true, entry: entryFromRow(data, new Date()) };
}

/** Un-save: removes the entry only while it's still in Saved (applied ones stay). */
export async function unsaveListing(listingId: string): Promise<ActionResult> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  const { error } = await m.supabase
    .from("applications")
    .delete()
    .eq("user_id", m.id)
    .eq("internship_id", String(listingId ?? ""))
    .eq("status", "saved");
  return error ? fail(SOMETHING_WRONG) : { ok: true };
}

/**
 * "Yes, I applied." Counts only if this user clicked Apply (or opened the
 * email) on this listing within the last 14 days, as logged by /go/:id.
 */
export async function confirmApplication(listingId: string): Promise<ActionResult<{ entry: LogEntry }>> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  const listing = await getListing(String(listingId ?? ""));
  if (!listing) return fail("That listing isn't available any more.");

  const admin = createServiceSupabase();
  const since = new Date(Date.now() - CONFIRM_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: clicks, error: clickError } = await admin
    .from("click_logs")
    .select("id")
    .eq("user_id", m.id)
    .eq("internship_id", listing.id)
    .gte("created_at", since)
    .limit(1);
  if (clickError) return fail(SOMETHING_WRONG);
  if (!clicks?.length) {
    return fail("We can only mark it applied after you use this listing's Apply button. You can still move it to Applied yourself.");
  }

  const now = new Date();
  const today = manilaDate(now);
  const { data: row } = await admin
    .from("applications")
    .select(APPLICATION_COLUMNS)
    .eq("user_id", m.id)
    .eq("internship_id", listing.id)
    .maybeSingle<ApplicationRow>();

  const result = row
    ? await admin
        .from("applications")
        .update({
          status: row.status === "saved" ? "applied" : row.status,
          applied_on: row.status === "saved" ? today : (row.applied_on ?? today),
          confirmed_at: row.confirmed_at ?? now.toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", m.id)
        .select(APPLICATION_COLUMNS)
        .single<ApplicationRow>()
    : await admin
        .from("applications")
        .insert({
          user_id: m.id,
          internship_id: listing.id,
          title: listing.title.slice(0, 100),
          company: listing.company.slice(0, 100),
          status: "applied",
          applied_on: today,
          confirmed_at: now.toISOString(),
        })
        .select(APPLICATION_COLUMNS)
        .single<ApplicationRow>();
  if (result.error || !result.data) {
    console.error("[confirmApplication]", result.error?.message);
    return fail(SOMETHING_WRONG);
  }
  // TODO(Phase 3): grant "Confirm an application" EXP here (+20 for the first 3 a day, then +5).
  return { ok: true, entry: entryFromRow(result.data, now) };
}

/* ------------------------------------------------------------------------ */
/* Entries: move, details, "not yet", remove, add by hand                    */
/* ------------------------------------------------------------------------ */

export async function moveApplication(entryId: string, to: string, outcome: string | null): Promise<ActionResult> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  const row = await readEntry(m, String(entryId ?? ""));
  if (!row) return fail(NOT_FOUND);
  const update = moveUpdate(row, to, outcome, manilaDate(new Date()));
  if (typeof update === "string") return fail(update);
  const { error } = await m.supabase.from("applications").update(update).eq("id", row.id);
  // TODO(Phase 3): +5 for a forward move, +10 for logging an offer or rejection (once per step).
  return error ? fail(SOMETHING_WRONG) : { ok: true };
}

export async function updateApplicationDetails(
  entryId: string,
  patch: { note: string; interviewAt: string | null; interviewHow: string },
): Promise<ActionResult> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  const details = validateDetails(patch);
  if (typeof details === "string") return fail(details);
  const row = await readEntry(m, String(entryId ?? ""));
  if (!row) return fail(NOT_FOUND);
  const { error } = await m.supabase.from("applications").update(details).eq("id", row.id);
  return error ? fail(SOMETHING_WRONG) : { ok: true };
}

/** "Not yet": stop asking "Did you apply?" until the next Apply click. */
export async function dismissApplyPrompt(entryId: string): Promise<ActionResult> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  const row = await readEntry(m, String(entryId ?? ""));
  if (!row) return fail(NOT_FOUND);
  const { error } = await m.supabase.from("applications").update({ prompt_dismissed_at: new Date().toISOString() }).eq("id", row.id);
  return error ? fail(SOMETHING_WRONG) : { ok: true };
}

/** Same as dismissApplyPrompt, by listing (Home asks about a listing, not an entry). */
export async function dismissApplyPromptForListing(listingId: string): Promise<ActionResult> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  const { error } = await m.supabase
    .from("applications")
    .update({ prompt_dismissed_at: new Date().toISOString() })
    .eq("user_id", m.id)
    .eq("internship_id", String(listingId ?? ""));
  return error ? fail(SOMETHING_WRONG) : { ok: true };
}

export async function removeApplication(entryId: string): Promise<ActionResult> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  if (!UUID.test(String(entryId ?? ""))) return fail(NOT_FOUND);
  const { error } = await m.supabase.from("applications").delete().eq("id", entryId);
  return error ? fail(SOMETHING_WRONG) : { ok: true };
}

/** An application from outside InternQuest (tracking only; never earns EXP, decision #18). */
export async function addExternalApplication(draft: ExternalDraft): Promise<ActionResult<{ entry: LogEntry }>> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  const today = manilaDate(new Date());
  const d: ExternalDraft = {
    title: String(draft?.title ?? ""),
    company: String(draft?.company ?? ""),
    url: String(draft?.url ?? ""),
    status: draft?.status,
    appliedOn: String(draft?.appliedOn ?? ""),
  };
  if (!isStatus(d.status) || (d.status as string) === "result") return fail("Pick a column from the list.");
  if (d.appliedOn && !/^\d{4}-\d{2}-\d{2}$/.test(d.appliedOn)) return fail("Pick the date you applied.");
  const errors = validateExternal(d, today);
  const first = Object.values(errors)[0];
  if (first) return fail(first);

  const { data, error } = await m.supabase
    .from("applications")
    .insert({
      title: d.title.trim(),
      company: d.company.trim(),
      url: d.url.trim() || null,
      status: d.status,
      applied_on: d.status === "saved" ? null : d.appliedOn || today,
    })
    .select(APPLICATION_COLUMNS)
    .single<ApplicationRow>();
  if (error || !data) return fail(SOMETHING_WRONG);
  return { ok: true, entry: entryFromRow(data, new Date()) };
}

/** Undo for "Remove": puts the entry back as it was (a confirmed application stays unconfirmed). */
export async function restoreApplication(entry: LogEntry): Promise<ActionResult<{ entry: LogEntry }>> {
  const m = await me();
  if (typeof m === "string") return fail(m);
  if (!entry || typeof entry !== "object") return fail(SOMETHING_WRONG);
  const details = validateDetails(entry);
  if (typeof details === "string") return fail(details);
  const move = moveUpdate({ status: "saved", applied_on: entry.appliedOn ?? null }, entry.status, entry.outcome, manilaDate(new Date()));
  if (typeof move === "string") return fail(move);
  const listing = entry.listingId ? await getListing(String(entry.listingId)) : null;
  const title = (listing?.title ?? String(entry.title ?? "")).trim().slice(0, 100);
  const company = (listing?.company ?? String(entry.company ?? "")).trim().slice(0, 100);
  if (!title || !company) return fail(SOMETHING_WRONG);
  const url = !listing && typeof entry.url === "string" && /^https?:\/\//.test(entry.url) ? entry.url.slice(0, 500) : null;
  const appliedOn = typeof entry.appliedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.appliedOn) ? entry.appliedOn : move.applied_on;

  const { data, error } = await m.supabase
    .from("applications")
    .insert({ internship_id: listing?.id ?? null, title, company, url, ...move, applied_on: appliedOn, ...details })
    .select(APPLICATION_COLUMNS)
    .single<ApplicationRow>();
  if (error || !data) return fail(SOMETHING_WRONG);
  return { ok: true, entry: entryFromRow(data, new Date()) };
}
