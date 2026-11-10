import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/aggregator/cron";
import { runDailyRefresh } from "@/lib/aggregator/refresh";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * The daily job (vercel.json, 04:00 Manila): import listings, hide expired
 * and dead ones. Vercel Hobby runs cron jobs at most once a day, which is all
 * this needs (SPEC §3). It also keeps a free Supabase project from pausing.
 * The weekly leaderboard needs no job: weeks are computed from EXP dates.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!cronAuthorized(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase isn't connected" }, { status: 503 });

  const summary = await runDailyRefresh();
  return NextResponse.json(summary, { status: summary.error ? 207 : 200, headers: { "Cache-Control": "no-store" } });
}
