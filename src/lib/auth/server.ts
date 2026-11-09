import "server-only";
import { headers } from "next/headers";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { RATE_LIMITS, rateLimitBucket, type RateLimitKind } from "./limits";
import { networkKey } from "./secrets";

/**
 * The visitor's network, as a one-way label. On Vercel, x-forwarded-for is
 * set by the platform (a visitor can't fake the first entry). Locally it may
 * be missing, and everyone shares one bucket, which is fine for development.
 */
export async function networkLabel(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev";
  return networkKey(ip, secret);
}

/**
 * Counts one try against a limit. Returns false when the limit is reached.
 * If the counter itself fails (for example, migration 0002 hasn't run yet),
 * it lets the request through and logs it: locking everyone out of their
 * accounts would be worse. Supabase Auth has its own limits behind this one.
 */
export async function takeRateLimit(kind: RateLimitKind, subject: string): Promise<boolean> {
  const { max, windowSeconds } = RATE_LIMITS[kind];
  const { data, error } = await createServiceSupabase().rpc("take_rate_limit", {
    p_bucket: rateLimitBucket(kind, subject),
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`[rate-limit] ${kind} check failed, allowing the request:`, error.message);
    return true;
  }
  return data === true;
}

/** The signed-in user's id, verified (getClaims checks the token's signature), or null. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}
