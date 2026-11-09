import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { APPLICATION_COLUMNS, type ApplicationRow } from "@/lib/tracker/rows";
import { accountFromRows, type Account, type ProfileRow, type RecoveryRow, type SettingsRow } from "./account";

/**
 * The signed-in user's account, or null when nobody is signed in (or in the
 * design preview, when Supabase isn't connected). Cached for one request.
 * Reads go through the user's own session, so row-level security applies.
 */
export const getAccount = cache(async (): Promise<Account | null> => {
  if (!isSupabaseConfigured()) return null;
  // Request time only: the session check reads the clock, which can't be part of a prerendered shell.
  await connection();
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getClaims();
  const id = auth?.claims?.sub;
  if (!id) return null;

  const [profile, skills, settings, recovery, applications] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, field_id, city_name, lat, lng, radius_km, work_type, status, school_id, avatar_skin, avatar_hair, onboarded_at, created_at")
      .eq("id", id)
      .maybeSingle<ProfileRow>(),
    supabase.from("user_skills").select("skill_id").eq("user_id", id).returns<{ skill_id: string }[]>(),
    supabase
      .from("user_settings")
      .select("mode, streaks, leaderboard, show_on_leaderboard, notes, animations, sound")
      .eq("user_id", id)
      .maybeSingle<SettingsRow>(),
    supabase.rpc("my_recovery").maybeSingle<RecoveryRow>(),
    supabase
      .from("applications")
      .select(APPLICATION_COLUMNS)
      .eq("user_id", id)
      .order("updated_at", { ascending: false })
      .limit(500)
      .overrideTypes<ApplicationRow[], { merge: false }>(),
  ]);

  // A database error is shown by the error page rather than treated as "signed out",
  // which would bounce the user to the login form for no reason.
  // Before migration 0004 has run, the quest log table doesn't exist yet: show an empty log, not an error page.
  const noQuestLogYet = applications.error?.code === "PGRST205";
  if (noQuestLogYet) console.warn("[account] applications table missing: run supabase/migrations/0004_quest_log.sql");
  const failed = profile.error ?? skills.error ?? settings.error ?? recovery.error ?? (noQuestLogYet ? null : applications.error);
  if (failed) throw new Error(`Couldn't load the account: ${failed.message}`);
  if (!profile.data) return null;

  return accountFromRows(
    profile.data,
    (skills.data ?? []).map((s) => s.skill_id),
    settings.data,
    recovery.data,
    noQuestLogYet ? [] : (applications.data ?? []),
  );
});
