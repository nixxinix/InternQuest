"use server";

/**
 * The optional AI helper (SPEC §9). Server only. Sends just the user's
 * skills, the text they typed, and the listing's short description. Capped
 * at 5 uses a day per user (ai_usage). The draft is returned to the browser
 * and never stored.
 */
import { AI_DAILY_LIMIT, buildPrompt, isAiKind, usesLeft, validateAiInput, type AiKind } from "@/lib/ai/prompts";
import { generateDraft, isAiEnabled } from "@/lib/ai/server";
import { TOO_MANY_TRIES } from "@/lib/auth/limits";
import { currentUserId, takeRateLimit } from "@/lib/auth/server";
import { skillName } from "@/lib/catalog/skills";
import { EXP, manilaDayOf, type ServerReward } from "@/lib/game/exp";
import { safeRewards } from "@/lib/game/server";
import { getListing } from "@/lib/listings/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

const fail = (error: string) => ({ ok: false as const, error });

const AI_ERRORS = {
  refused: "The AI helper couldn't write this one. Try different wording, or write it yourself with the tips guide.",
  busy: "The AI helper is busy right now. Try again in a minute.",
  unavailable: "The AI helper isn't working right now. Try again later.",
} as const;

/** Uses today (Manila day), counted on the server. */
async function usedToday(userId: string): Promise<number> {
  const since = new Date(Date.now() - 36 * 3_600_000).toISOString();
  const { data } = await createServiceSupabase().from("ai_usage").select("created_at").eq("user_id", userId).gte("created_at", since);
  const today = manilaDayOf(new Date().toISOString());
  return (data ?? []).filter((r: { created_at: string }) => manilaDayOf(r.created_at) === today).length;
}

export async function aiDraft(
  kind: AiKind,
  listingId: string,
  text: string,
): Promise<ActionResult<{ draft: string; usesLeft: number }>> {
  if (!isSupabaseConfigured() || !isAiEnabled()) return fail("The AI helper is turned off.");
  const userId = await currentUserId();
  if (!userId) return fail("You're signed out. Log in again, then retry.");
  if (!isAiKind(kind)) return fail("Pick what you want help with.");
  const input = validateAiInput(kind, text);
  if (!input.ok) return fail(input.error);
  if (!(await takeRateLimit("ai", userId))) return fail(TOO_MANY_TRIES);
  const listing = await getListing(String(listingId ?? ""));
  if (!listing) return fail("That listing isn't available any more.");

  const used = await usedToday(userId);
  if (used >= AI_DAILY_LIMIT) return fail(`You've used your ${AI_DAILY_LIMIT} AI drafts for today. They reset at midnight.`);

  // Count the use before calling, so parallel requests can't slip past the cap; refund it if the call fails.
  const admin = createServiceSupabase();
  const { data: usage, error } = await admin
    .from("ai_usage")
    .insert({ user_id: userId, kind, internship_id: listing.id })
    .select("id")
    .single<{ id: number }>();
  if (error || !usage) return fail(AI_ERRORS.unavailable);

  const supabase = await createServerSupabase();
  const { data: skills } = await supabase.from("user_skills").select("skill_id").eq("user_id", userId);
  const prompt = buildPrompt(kind, {
    skills: (skills ?? []).map((s: { skill_id: string }) => skillName(s.skill_id)),
    text: input.text,
    listing: { title: listing.title, company: listing.company, snippet: listing.snippet },
  });

  const result = await generateDraft(prompt.system, prompt.user);
  if (!result.ok) {
    await admin.from("ai_usage").delete().eq("id", usage.id);
    return fail(AI_ERRORS[result.reason]);
  }
  return { ok: true, draft: result.text, usesLeft: usesLeft(used + 1) };
}

/**
 * "I used this cover letter" (SPEC §10 "Tailored cover letter used +10").
 * Once per listing, and only if a cover letter draft was made for it.
 */
export async function markCoverLetterUsed(listingId: string): Promise<ActionResult<{ reward: ServerReward | null }>> {
  if (!isSupabaseConfigured()) return fail("Accounts aren't connected in this preview yet.");
  const userId = await currentUserId();
  if (!userId) return fail("You're signed out. Log in again, then retry.");
  const { data } = await createServiceSupabase()
    .from("ai_usage")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "cover_letter")
    .eq("internship_id", String(listingId ?? ""))
    .limit(1);
  if (!data?.length) return fail("Draft a cover letter for this listing first.");
  return { ok: true, reward: await safeRewards(userId, [{ kind: "cover_letter", ref: String(listingId), amount: EXP.coverLetter }]) };
}
