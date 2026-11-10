"use server";

/**
 * "Report this listing" (SPEC §12). Works signed in or as a guest; reporters
 * are never shown to the company or in the admin queue. 3 or more open
 * "asks for payment" reports hide the listing right away, until an admin
 * looks (decision #99/the W14 design).
 */
import { AUTO_HIDE_PAYMENT_REPORTS, REPORT_REASON_LABEL, type ReportReason } from "@/lib/admin/queue";
import { TOO_MANY_TRIES } from "@/lib/auth/limits";
import { currentUserId, networkLabel, takeRateLimit } from "@/lib/auth/server";
import { getListing } from "@/lib/listings/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

const fail = (error: string) => ({ ok: false as const, error });
const isReportReason = (r: unknown): r is ReportReason => typeof r === "string" && r in REPORT_REASON_LABEL;

export async function reportListing(listingId: string, reason: string, note: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return fail("Accounts aren't connected in this preview yet.");
  if (!isReportReason(reason)) return fail("Pick the reason that fits best.");
  const trimmedNote = typeof note === "string" ? note.trim().slice(0, 500) : "";
  if (reason === "other" && !trimmedNote) return fail("Tell us a little about what's wrong.");

  const listing = await getListing(String(listingId ?? ""));
  if (!listing) return fail("That listing isn't available any more.");

  const [userId, network] = await Promise.all([currentUserId(), networkLabel()]);
  const [netOk, listingOk] = await Promise.all([
    takeRateLimit("report", network),
    takeRateLimit("reportListing", `${network}:${listing.id}`),
  ]);
  if (!netOk || !listingOk) return fail(TOO_MANY_TRIES);

  const admin = createServiceSupabase();
  const { error } = await admin.from("reports").insert({ internship_id: listing.id, user_id: userId, reason, note: trimmedNote || null });
  if (error) {
    console.error("[reportListing]", error.message);
    return fail("Couldn't send that. Check your connection and try again.");
  }

  if (reason === "payment") {
    const { count } = await admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("internship_id", listing.id)
      .eq("reason", "payment")
      .is("resolved_at", null);
    if ((count ?? 0) >= AUTO_HIDE_PAYMENT_REPORTS) {
      await admin.from("internships").update({ is_active: false }).eq("id", listing.id);
    }
  }
  return { ok: true };
}
