"use server";

/**
 * Profile, settings, and "Download my data". These run as the signed-in user
 * (row-level security and the column grants in 0002_accounts.sql apply), so a
 * user can only ever change their own rows.
 */
import {
  accountFromRows,
  cityIdFromRow,
  validateProfileInput,
  validateSettingsPatch,
  type ProfileInput,
  type ProfileRow,
  type RecoveryRow,
  type SettingsRow,
} from "@/lib/account/account";
import { TOO_MANY_TRIES } from "@/lib/auth/limits";
import { currentUserId, takeRateLimit } from "@/lib/auth/server";
import { EXP, type ExpEvent, type ServerReward } from "@/lib/game/exp";
import { APPLICATION_COLUMNS, type ApplicationRow } from "@/lib/tracker/rows";
import { safeRewards } from "@/lib/game/server";
import { geocodePlace } from "@/lib/geo/geocode";
import { buildDataExport, type UserSettings } from "@/lib/settings/settings";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "./auth";

const NOT_CONNECTED = "Accounts aren't connected in this preview yet.";
const NOT_SIGNED_IN = "You're signed out. Log in again, then retry.";
const SOMETHING_WRONG = "Couldn't save. Check your connection and try again.";

const fail = (error: string) => ({ ok: false as const, error });

const PLACE_ERRORS = {
  "not-found": "We couldn't find that place in the Philippines. Try the city or town name, like Antipolo.",
  busy: "The map lookup is busy right now. Try saving again in a few seconds.",
  unavailable: "The map lookup isn't working right now. Pick a city from the list, or leave it empty for now.",
} as const;

/**
 * Onboarding step 4 and Profile > Edit. `finishOnboarding` marks sign-up as
 * complete. A new place typed in the city box is looked up on the map here.
 * Returns the saved city id, so the screen shows what was found.
 */
export async function saveProfile(
  values: ProfileInput,
  finishOnboarding = false,
): Promise<ActionResult<{ cityId: string | null; reward: ServerReward | null }>> {
  if (!isSupabaseConfigured()) return fail(NOT_CONNECTED);
  const id = await currentUserId();
  if (!id) return fail(NOT_SIGNED_IN);
  const check = validateProfileInput(values);
  if (!check.ok) return fail(check.error);

  let place: { name: string; lat: number; lng: number } | null = null;
  if (check.city.kind === "known") place = check.city;
  if (check.city.kind === "lookup") {
    if (!(await takeRateLimit("geocode", id))) return fail(TOO_MANY_TRIES);
    const found = await geocodePlace(check.city.text);
    if (!found.ok) return fail(PLACE_ERRORS[found.reason]);
    place = found.place;
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ ...check.update, city_name: place?.name ?? null, lat: place?.lat ?? null, lng: place?.lng ?? null })
    .eq("id", id);
  if (error) {
    console.error("[saveProfile] profile update failed:", error.message);
    return fail(SOMETHING_WRONG);
  }
  const { error: skillsError } = await supabase.rpc("set_my_skills", { p_skills: check.skills });
  if (skillsError) {
    console.error("[saveProfile] skills update failed:", skillsError.message);
    return fail(SOMETHING_WRONG);
  }
  let reward: ServerReward | null = null;
  if (finishOnboarding) {
    await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", id).is("onboarded_at", null);
    // "Complete profile": +50, once ever.
    reward = await safeRewards(id, [{ kind: "profile", ref: "once", amount: EXP.profile }]);
  }
  return { ok: true, cityId: place ? cityIdFromRow(place.name, place.lat, place.lng) : null, reward };
}

/** Each Settings change saves on its own (W11), and onboarding saves the play style. */
export async function saveSettings(patch: Partial<UserSettings>): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return fail(NOT_CONNECTED);
  const id = await currentUserId();
  if (!id) return fail(NOT_SIGNED_IN);
  const row = validateSettingsPatch(patch);
  if (!row) return fail("That setting can't be changed.");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("user_settings").update(row).eq("user_id", id).select("user_id");
  if (error || !data?.length) {
    console.error("[saveSettings] failed:", error?.message ?? "no settings row");
    return fail(SOMETHING_WRONG);
  }
  return { ok: true };
}

/**
 * Everything we hold about the user (Data Privacy Act right to access),
 * read fresh from the database. Never includes the password or code hashes.
 */
export async function exportMyData(): Promise<ActionResult<{ data: ReturnType<typeof buildDataExport>; username: string }>> {
  if (!isSupabaseConfigured()) return fail(NOT_CONNECTED);
  const id = await currentUserId();
  if (!id) return fail(NOT_SIGNED_IN);

  const supabase = await createServerSupabase();
  const admin = createServiceSupabase();
  const [profile, skills, settings, recovery, applications, events, badges, tips, aiUses, opens] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, field_id, city_name, lat, lng, radius_km, work_type, status, school_id, avatar_skin, avatar_hair, consented_at, age_confirmed_at, onboarded_at, created_at, updated_at")
      .eq("id", id)
      .maybeSingle<ProfileRow & { consented_at: string; age_confirmed_at: string; updated_at: string }>(),
    supabase.from("user_skills").select("skill_id").eq("user_id", id),
    supabase
      .from("user_settings")
      .select("mode, streaks, leaderboard, show_on_leaderboard, notes, animations, sound")
      .eq("user_id", id)
      .maybeSingle<SettingsRow>(),
    supabase.rpc("my_recovery").maybeSingle<RecoveryRow>(),
    supabase.from("applications").select(APPLICATION_COLUMNS).eq("user_id", id).order("created_at").limit(500).overrideTypes<ApplicationRow[], { merge: false }>(),
    supabase.from("exp_events").select("kind, ref, amount, created_at").eq("user_id", id).order("created_at").overrideTypes<ExpEvent[], { merge: false }>(),
    supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", id).overrideTypes<{ badge_id: string; earned_at: string }[], { merge: false }>(),
    supabase.from("tips_progress").select("slug, done, updated_at").eq("user_id", id),
    // Server-only tables: read with the service key, filtered to this user.
    admin.from("ai_usage").select("kind, internship_id, created_at").eq("user_id", id).order("created_at"),
    admin.from("resource_opens").select("resource_id, opened_at").eq("user_id", id),
  ]);
  const failed = profile.error ?? skills.error ?? settings.error ?? recovery.error ?? applications.error ?? events.error ?? badges.error;
  if (failed || !profile.data) return fail(SOMETHING_WRONG);

  const p = profile.data;
  const apps = applications.data ?? [];
  const account = accountFromRows(
    p,
    (skills.data ?? []).map((s: { skill_id: string }) => s.skill_id),
    settings.data,
    recovery.data,
    apps,
    new Date(),
    { events: events.data ?? [], badges: (badges.data ?? []).map((b) => b.badge_id) },
  );
  const data = buildDataExport(
    {
      account: {
        username: account.username,
        recovery: account.recovery.kind,
        recoveryEmail: account.recovery.kind === "email" ? account.recovery.email : null,
      },
      profile: {
        field: account.field,
        skills: account.skills,
        city: p.city_name,
        // Rounded to about 1 km when saved.
        cityLocation: p.lat !== null && p.lng !== null ? { lat: Number(p.lat), lng: Number(p.lng) } : null,
        searchRadiusKm: p.radius_km,
        workType: account.workType,
        status: account.status,
        school: account.school,
        avatar: account.look,
        joined: p.created_at,
        privacyConsentGiven: p.consented_at,
        ageConfirmed: p.age_confirmed_at,
        lastUpdated: p.updated_at,
      },
      progress: {
        level: account.progress.level,
        totalExp: account.progress.totalExp,
        streakWeeks: account.progress.streakWeeks,
        applicationsConfirmed: account.quest.confirmedCount,
        badges: badges.data ?? [],
        expHistory: (events.data ?? []).map((e) => ({ for: e.kind, amount: e.amount, at: e.created_at })),
      },
      settings: account.settings,
      // Before migration 0006 these tables don't exist yet; the export still works without them.
      more: {
        tipsChecklists: tips.error ? [] : (tips.data ?? []),
        aiHelperUses: aiUses.error ? [] : (aiUses.data ?? []),
        learningResourcesOpened: opens.error ? [] : (opens.data ?? []),
      },
      questLog: apps.map((r) => ({
        title: r.title,
        company: r.company,
        listing: r.internship_id,
        link: r.url,
        status: r.status,
        result: r.outcome,
        appliedOn: r.applied_on,
        interviewAt: r.interview_at,
        interviewHow: r.interview_how,
        note: r.note,
        confirmedByYou: r.confirmed_at,
        lastApplyClick: r.last_clicked_at,
      })),
    },
    new Date(),
  );
  return { ok: true, data, username: account.username };
}
