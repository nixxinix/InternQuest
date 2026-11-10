"use server";

/**
 * Admin queue decisions (W14, SPEC §14 "log admin actions"). Every action
 * re-validates against the real row (never the client's copy), applies its
 * effect, and writes an audit entry — all server side, behind an admin
 * membership check (src/lib/admin/server.ts).
 */
import {
  approveCompany,
  clearFlag,
  currentAdmin,
  dismissReports,
  hideListing,
  loadCompanyItem,
  loadFlagItem,
  loadReportItem,
  recheckCompanyWebsite,
  rejectCompany,
  reverseExpForFlag,
  suspendCompanyFromReport,
  suspendUserFromFlag,
  writeAudit,
} from "@/lib/admin/server";
import { decide, flagItemRowId, reportItemInternshipId, type QueueKind } from "@/lib/admin/queue";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

const fail = (error: string) => ({ ok: false as const, error });
const KINDS: QueueKind[] = ["company", "report", "flag"];

export async function decideQueueItem(kind: string, itemId: string, actionId: string, reason: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return fail("You need an admin account for this.");
  if (!KINDS.includes(kind as QueueKind) || typeof itemId !== "string" || !itemId) return fail("That item doesn't exist any more.");
  const k = kind as QueueKind;

  const item =
    k === "company"
      ? await loadCompanyItem(itemId)
      : k === "report"
        ? (reportItemInternshipId(itemId) && (await loadReportItem(reportItemInternshipId(itemId)!))) || null
        : (flagItemRowId(itemId) !== null && (await loadFlagItem(flagItemRowId(itemId)!))) || null;
  if (!item) return fail("That item was already decided, or isn't here any more.");

  let decision;
  try {
    decision = decide([item], item.id, actionId, reason, admin.label, new Date());
  } catch {
    return fail("Pick a reason from the list.");
  }
  const { entry } = decision;

  try {
    if (k === "company") {
      const ok = actionId === "approve" ? await approveCompany(itemId) : actionId === "reject" ? await rejectCompany(itemId, entry.reason) : false;
      if (!ok) return fail("Couldn't save that. It may have just been decided by someone else.");
    } else if (k === "report") {
      const internshipId = reportItemInternshipId(itemId)!;
      if (actionId === "hide") await hideListing(internshipId, entry.reason);
      else if (actionId === "dismiss") await dismissReports(internshipId, entry.reason);
      else if (actionId === "suspend") await suspendCompanyFromReport(internshipId);
      else return fail("Unknown action.");
    } else {
      const flagId = flagItemRowId(itemId)!;
      if (actionId === "clear") await clearFlag(flagId);
      else if (actionId === "reverse" || actionId === "suspend") {
        const { data: row } = await createServiceSupabase()
          .from("activity_flags")
          .select("user_id, window_start, window_end")
          .eq("id", flagId)
          .maybeSingle<{ user_id: string; window_start: string | null; window_end: string | null }>();
        if (!row) return fail("That flag isn't here any more.");
        if (actionId === "reverse") await reverseExpForFlag(flagId, row.user_id, row.window_start, row.window_end);
        else await suspendUserFromFlag(flagId, row.user_id);
      } else return fail("Unknown action.");
    }
  } catch (e) {
    console.error("[admin] decision failed:", e instanceof Error ? e.message : e);
    return fail("Something went wrong while saving that. Try again.");
  }

  await writeAudit(admin, entry);
  return { ok: true };
}

/** Admin's "Recheck" button on a pending company's website. */
export async function recheckWebsite(companyId: string): Promise<ActionResult<{ loads: boolean }>> {
  const admin = await currentAdmin();
  if (!admin) return fail("You need an admin account for this.");
  const loads = await recheckCompanyWebsite(String(companyId ?? ""));
  if (loads === null) return fail("That company isn't here any more.");
  return { ok: true, loads };
}

/** Admin can confirm an email by hand (used only when outbound email isn't configured). */
export async function markCompanyEmailConfirmed(companyId: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return fail("You need an admin account for this.");
  const id = String(companyId ?? "");
  const { data, error } = await createServiceSupabase()
    .from("companies")
    .update({ email_confirmed: true })
    .eq("id", id)
    .select("name")
    .maybeSingle<{ name: string }>();
  if (error) return fail("Couldn't save that.");
  if (!data) return fail("That company isn't here any more.");
  await writeAudit(admin, { kind: "company", itemId: id, subject: data.name, action: "Marked email confirmed", reason: "Checked by hand" });
  return { ok: true };
}
