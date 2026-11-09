"use server";

/**
 * Small EXP actions that aren't part of the quest log: tutorial steps and
 * finished tips checklists. The server decides the amounts; each is once only
 * (exp_events is unique per kind and ref).
 */
import { TOO_MANY_TRIES } from "@/lib/auth/limits";
import { currentUserId, takeRateLimit } from "@/lib/auth/server";
import { findResource } from "@/lib/catalog/resources";
import { skillName } from "@/lib/catalog/skills";
import { loadGuide } from "@/lib/content/loadGuides";
import { isGuideSlug } from "@/lib/content/tips";
import { EXP, resourceEarnsExp, type ServerReward } from "@/lib/game/exp";
import { safeRewards } from "@/lib/game/server";
import { getListing } from "@/lib/listings/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

const fail = (error: string) => ({ ok: false as const, error });

async function signedIn(): Promise<string | ActionResult> {
  if (!isSupabaseConfigured()) return fail("Accounts aren't connected in this preview yet.");
  const id = await currentUserId();
  if (!id) return fail("You're signed out. Log in again, then retry.");
  if (!(await takeRateLimit("questLog", id))) return fail(TOO_MANY_TRIES);
  return id;
}

/** Tutorial: "View your top match" (+10, once). Any open listing counts. */
export async function markViewedMatch(listingId: string): Promise<ActionResult<{ reward: ServerReward | null }>> {
  const id = await signedIn();
  if (typeof id !== "string") return id as ActionResult<{ reward: null }>;
  if (!(await getListing(String(listingId ?? "")))) return fail("That listing isn't available any more.");
  return { ok: true, reward: await safeRewards(id, [{ kind: "view_match", ref: "once", amount: EXP.viewMatch }]) };
}

/**
 * "I finished it" on a learning resource for a missing skill: +15 once per
 * skill, and the "Skill up" badge. Counts only if the resource was opened
 * through /learn/:id at least 2 minutes earlier (both times on the server).
 */
export async function finishResource(
  resourceId: string,
): Promise<ActionResult<{ reward: ServerReward | null; skillId: string; skillName: string }>> {
  const id = await signedIn();
  if (typeof id !== "string") return id as ActionResult<{ reward: null; skillId: string; skillName: string }>;
  const resource = findResource(String(resourceId ?? ""));
  if (!resource) return fail("That resource isn't on our list.");

  const { data } = await createServiceSupabase()
    .from("resource_opens")
    .select("opened_at")
    .eq("user_id", id)
    .eq("resource_id", resource.id)
    .maybeSingle<{ opened_at: string }>();
  const check = resourceEarnsExp(data ? new Date(data.opened_at) : null, new Date());
  if (!check.ok) {
    return fail(
      check.reason === "not-opened"
        ? "Open the resource first, then come back to mark it done."
        : check.reason === "too-fast"
          ? "Take your time with it. You can mark it done a few minutes after opening it."
          : "That was a while ago. Open it again, then mark it done.",
    );
  }
  const reward = await safeRewards(id, [{ kind: "resource", ref: resource.skillId, amount: EXP.resource }]);
  return { ok: true, reward, skillId: resource.skillId, skillName: skillName(resource.skillId) };
}

/**
 * Checklist ticks follow you across devices (SPEC §13 tips_progress). Only
 * ids that exist in that guide's checklist are kept.
 */
export async function saveChecklistProgress(slug: string, done: string[]): Promise<ActionResult> {
  const id = await signedIn();
  if (typeof id !== "string") return id;
  if (!isGuideSlug(slug) || !Array.isArray(done)) return fail("That guide doesn't exist.");
  const known = new Set((await loadGuide(slug)).checklist.map((c) => c.id));
  const kept = [...new Set(done.filter((d) => typeof d === "string" && known.has(d)))].slice(0, 50);
  const { error } = await createServiceSupabase()
    .from("tips_progress")
    .upsert({ user_id: id, slug, done: kept, updated_at: new Date().toISOString() }, { onConflict: "user_id,slug" });
  return error ? fail("Couldn't save your checklist. It's still saved on this device.") : { ok: true };
}

/**
 * "Finish a tips checklist" (+10, once per guide). The ticks live in the
 * browser, so this is self-reported; it's capped at once per guide (3 guides).
 * The interview checklist also earns the "Prepared" badge.
 */
export async function completeChecklist(slug: string): Promise<ActionResult<{ reward: ServerReward | null }>> {
  const id = await signedIn();
  if (typeof id !== "string") return id as ActionResult<{ reward: null }>;
  if (!isGuideSlug(slug)) return fail("That guide doesn't exist.");
  return { ok: true, reward: await safeRewards(id, [{ kind: "checklist", ref: slug, amount: EXP.checklist }]) };
}
