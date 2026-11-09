import "server-only";
import { connection } from "next/server";
import { currentUserId } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServiceSupabase } from "@/lib/supabase/server";
import { addDays } from "@/lib/tracker/log";
import type { BoardEntry, WeekTotals } from "./leaderboard";
import { manilaWeekStart, weekStartInstant } from "./streak";

export type BoardData = { entries: BoardEntry[]; lastWeek: WeekTotals | null };

type Row = {
  username: string;
  school_id: string | null;
  week_exp: number;
  week_apps: number;
  total_exp: number;
  total_apps: number;
  hidden: boolean;
  is_me: boolean;
};

/**
 * The leaderboard, computed on the server (SPEC §10: the client never ranks
 * its own numbers). Usernames and school ids only. The week resets Monday
 * 00:00 in Manila. Null in the design preview or when signed out.
 */
export async function getBoard(): Promise<BoardData | null> {
  if (!isSupabaseConfigured()) return null;
  await connection();
  const me = await currentUserId();
  if (!me) return null;

  const now = new Date();
  const thisWeek = manilaWeekStart(now);
  const weekStart = weekStartInstant(thisWeek);
  const lastWeekStart = weekStartInstant(addDays(thisWeek, -7));
  const admin = createServiceSupabase();

  const [board, lastExp, lastApps, firstEvent] = await Promise.all([
    admin.rpc("leaderboard_entries", { p_me: me, p_week_start: weekStart }),
    admin.from("exp_events").select("amount").eq("user_id", me).gte("created_at", lastWeekStart).lt("created_at", weekStart),
    admin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", me)
      .gte("confirmed_at", lastWeekStart)
      .lt("confirmed_at", weekStart),
    admin.from("exp_events").select("created_at").eq("user_id", me).order("created_at").limit(1),
  ]);
  if (board.error) throw new Error(`Couldn't load the leaderboard: ${board.error.message}`);

  const firstAt = (firstEvent.data?.[0] as { created_at: string } | undefined)?.created_at;
  const startedBeforeThisWeek = firstAt !== undefined && new Date(firstAt).getTime() < new Date(weekStart).getTime();

  return {
    entries: ((board.data ?? []) as Row[]).map((r) => ({
      username: r.username,
      school: r.school_id,
      weekExp: r.week_exp,
      weekApps: r.week_apps,
      totalExp: r.total_exp,
      totalApps: r.total_apps,
      hidden: r.hidden,
    })),
    // No last week to compare with until someone has been around for one.
    lastWeek: startedBeforeThisWeek
      ? { exp: (lastExp.data ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0), apps: lastApps.count ?? 0 }
      : null,
  };
}
