import "server-only";
import { createServiceSupabase } from "@/lib/supabase/server";
import {
  EXP,
  WEEKLY_GOAL,
  capToDaily,
  earnedBadges,
  earnedToday,
  progressFrom,
  type ExpEvent,
  type ExpKind,
  type ServerReward,
} from "./exp";
import { manilaWeekStart, weekStartInstant } from "./streak";

/**
 * The only place EXP is granted (CLAUDE.md hard rule). Uses the service role
 * because the API roles can't write exp_events or user_badges.
 */

export type Grant = { kind: ExpKind; ref: string; amount: number };


/** More confirmations than this in one hour are flagged for the admin (decision #99). */
export const FLAG_CONFIRMS_PER_HOUR = 10;

type Admin = ReturnType<typeof createServiceSupabase>;

async function load(admin: Admin, userId: string, now: Date) {
  const weekStart = weekStartInstant(manilaWeekStart(now));
  const [events, profile, apps, badges] = await Promise.all([
    admin.from("exp_events").select("kind, ref, amount, created_at").eq("user_id", userId).order("created_at").limit(10000),
    admin.from("profiles").select("created_at").eq("id", userId).single<{ created_at: string }>(),
    admin.from("applications").select("internship_id, status, confirmed_at").eq("user_id", userId).limit(500),
    admin.from("user_badges").select("badge_id").eq("user_id", userId),
  ]);
  const failed = events.error ?? profile.error ?? apps.error ?? badges.error;
  if (failed) throw new Error(`Couldn't load progress: ${failed.message}`);

  const rows = (apps.data ?? []) as { internship_id: string | null; status: string; confirmed_at: string | null }[];
  const list = (events.data ?? []) as ExpEvent[];
  const confirmedThisWeek = rows.filter((r) => r.confirmed_at && r.confirmed_at >= weekStart).length;
  const progress = progressFrom(list, { joinedAt: profile.data!.created_at, now, confirmedThisWeek });
  return {
    events: list,
    progress,
    weekStart,
    confirmedThisWeek,
    badges: (badges.data ?? []).map((b: { badge_id: string }) => b.badge_id),
    stats: {
      confirmed: rows.filter((r) => r.confirmed_at).length,
      resultsLogged: rows.filter((r) => r.status === "result").length,
      listingsSaved: rows.filter((r) => r.internship_id).length,
      streakWeeks: progress.streakWeeks,
      checklists: list.filter((e) => e.kind === "checklist").map((e) => e.ref),
      resourcesFinished: list.filter((e) => e.kind === "resource").length,
    },
  };
}

/**
 * Inserts one grant unless it was already given; returns the EXP actually
 * granted. Over the daily cap it's still recorded, at 0 EXP, so the same
 * action can't be cashed in again tomorrow.
 */
async function insertGrant(admin: Admin, userId: string, g: Grant, roomToday: number): Promise<number> {
  const amount = Math.min(g.amount, Math.max(0, roomToday));
  const { data, error } = await admin
    .from("exp_events")
    .upsert({ user_id: userId, kind: g.kind, ref: g.ref.slice(0, 120), amount }, { onConflict: "user_id,kind,ref", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`Couldn't grant EXP: ${error.message}`);
  return data && data.length > 0 ? amount : 0;
}

/**
 * Grants EXP for an action, then checks what follows from it (weekly goal,
 * badges, unusual activity), and returns the before/after for the screen.
 * Pass no grants to just re-check (for example after saving a listing).
 */
export async function applyRewards(userId: string, grants: Grant[]): Promise<ServerReward> {
  const admin = createServiceSupabase();
  const now = new Date();
  const before = await load(admin, userId, now);

  let room = capToDaily(Number.MAX_SAFE_INTEGER, earnedToday(before.events, now));
  for (const g of grants) room -= await insertGrant(admin, userId, g, room);

  let after = await load(admin, userId, now);

  // Weekly quest reached: +30 once per week.
  if (after.confirmedThisWeek >= WEEKLY_GOAL) {
    const extra = await insertGrant(admin, userId, { kind: "weekly_goal", ref: manilaWeekStart(now), amount: EXP.weeklyGoal }, room);
    if (extra > 0) after = await load(admin, userId, now);
  }

  // Badges: effort only. Inserting an existing one does nothing.
  const due = earnedBadges(after.stats).filter((b) => !after.badges.includes(b));
  if (due.length) {
    const { error } = await admin
      .from("user_badges")
      .upsert(due.map((badge_id) => ({ user_id: userId, badge_id })), { onConflict: "user_id,badge_id", ignoreDuplicates: true });
    if (error) console.error("[rewards] couldn't save badges:", error.message);
  }

  // Unusual activity: many confirmations in an hour. Flag once, the moment it passes the line.
  if (grants.some((g) => g.kind === "confirm")) {
    const hourAgo = new Date(now.getTime() - 3_600_000).toISOString();
    const lastHour = after.events.filter((e) => e.kind === "confirm" && e.created_at >= hourAgo).length;
    if (lastHour === FLAG_CONFIRMS_PER_HOUR + 1) {
      await admin.from("activity_flags").insert({ user_id: userId, reason: `${lastHour} confirmed applications within one hour` });
    }
  }

  const badges = [...after.badges, ...due];
  return {
    amount: after.progress.totalExp - before.progress.totalExp,
    leveledUp: after.progress.level > before.progress.level,
    newBadges: due,
    progress: after.progress,
    badges,
  };
}

/** Rewards never block the action itself: on any error the action still succeeds, without EXP. */
export async function safeRewards(userId: string, grants: Grant[]): Promise<ServerReward | null> {
  try {
    return await applyRewards(userId, grants);
  } catch (e) {
    console.error("[rewards]", e instanceof Error ? e.message : e);
    return null;
  }
}
