import "server-only";
import { currentUserId, networkLabel, takeRateLimit } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { Listing } from "./listing";

/**
 * Logs an Apply click (SPEC §5.5). Stores the listing, the time, and the
 * user if signed in: never an IP address. For a signed-in user the listing
 * also lands in their quest log (Saved) with "Did you apply?" waiting, so the
 * question can be asked on any device. Best effort: applying must never fail
 * because logging did.
 */
export async function logApplyClick(listing: Listing, kind: "link" | "email"): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    // Abuse guard: a flood from one network stops being counted (the redirect still works).
    if (!(await takeRateLimit("click", await networkLabel()))) return;
    const userId = await currentUserId();
    const admin = createServiceSupabase();
    const now = new Date().toISOString();

    const { error } = await admin.from("click_logs").insert({ internship_id: listing.id, user_id: userId, kind });
    if (error) {
      console.error("[click] couldn't log:", error.message);
      return;
    }
    if (!userId) return;

    const { data: existing } = await admin
      .from("applications")
      .select("id")
      .eq("user_id", userId)
      .eq("internship_id", listing.id)
      .maybeSingle<{ id: string }>();
    const { error: appError } = existing
      ? await admin.from("applications").update({ last_clicked_at: now }).eq("id", existing.id)
      : await admin.from("applications").insert({
          user_id: userId,
          internship_id: listing.id,
          title: listing.title.slice(0, 100),
          company: listing.company.slice(0, 100),
          status: "saved",
          last_clicked_at: now,
        });
    if (appError) console.error("[click] couldn't update the quest log:", appError.message);
  } catch (e) {
    console.error("[click] failed:", e instanceof Error ? e.message : e);
  }
}
