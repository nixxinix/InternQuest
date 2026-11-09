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
import { geocodePlace } from "@/lib/geo/geocode";
import { buildDataExport, type UserSettings } from "@/lib/settings/settings";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
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
): Promise<ActionResult<{ cityId: string | null }>> {
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
  if (finishOnboarding) {
    // TODO(Phase 3): award "Complete profile" (+50 EXP, once) through exp_events here.
    await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", id).is("onboarded_at", null);
  }
  return { ok: true, cityId: place ? cityIdFromRow(place.name, place.lat, place.lng) : null };
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
  const [profile, skills, settings, recovery] = await Promise.all([
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
  ]);
  if (profile.error || skills.error || settings.error || recovery.error || !profile.data) return fail(SOMETHING_WRONG);

  const p = profile.data;
  const account = accountFromRows(p, (skills.data ?? []).map((s: { skill_id: string }) => s.skill_id), settings.data, recovery.data);
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
      // EXP, streaks, and badges arrive in Phase 3; the quest log in Phase 2.
      progress: { level: 1, totalExp: 0, streakWeeks: 0, applications: 0, badges: [] },
      settings: account.settings,
      questLog: [],
    },
    new Date(),
  );
  return { ok: true, data, username: account.username };
}
