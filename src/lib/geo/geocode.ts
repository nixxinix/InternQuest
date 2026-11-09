import "server-only";
import { takeRateLimit } from "@/lib/auth/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { nominatimUrl, normalizePlaceQuery, parseNominatim, type FoundPlace } from "./nominatim";

export type GeocodeResult =
  | { ok: true; place: FoundPlace }
  | { ok: false; reason: "not-found" | "busy" | "unavailable" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Finds a typed place in the Philippines. Cached answers come from the
 * database; new ones from Nominatim, at most one request per second for the
 * whole app. Only the place text is sent, never who typed it.
 */
export async function geocodePlace(text: string): Promise<GeocodeResult> {
  const query = normalizePlaceQuery(text);
  const admin = createServiceSupabase();

  const { data: cached } = await admin
    .from("geocode_cache")
    .select("found, name, lat, lng")
    .eq("query", query)
    .maybeSingle<{ found: boolean; name: string | null; lat: number | string | null; lng: number | string | null }>();
  if (cached) {
    return cached.found && cached.name
      ? { ok: true, place: { name: cached.name, lat: Number(cached.lat), lng: Number(cached.lng) } }
      : { ok: false, reason: "not-found" };
  }

  const agent = process.env.NOMINATIM_USER_AGENT;
  if (!agent) {
    console.error("[geocode] NOMINATIM_USER_AGENT is not set, so new places can't be looked up.");
    return { ok: false, reason: "unavailable" };
  }

  // Someone else may have just used this second; wait once and try again.
  let allowed = await takeRateLimit("nominatim", "app");
  if (!allowed) {
    await sleep(1100);
    allowed = await takeRateLimit("nominatim", "app");
  }
  if (!allowed) return { ok: false, reason: "busy" };

  let json: unknown;
  try {
    const res = await fetch(nominatimUrl(text), {
      headers: { "User-Agent": agent, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[geocode] Nominatim answered", res.status);
      return { ok: false, reason: res.status === 429 ? "busy" : "unavailable" };
    }
    json = await res.json();
  } catch (e) {
    console.error("[geocode] lookup failed:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "unavailable" };
  }

  const place = parseNominatim(json);
  const { error } = await admin
    .from("geocode_cache")
    .upsert(place ? { query, found: true, name: place.name, lat: place.lat, lng: place.lng } : { query, found: false, name: null, lat: null, lng: null });
  if (error) console.error("[geocode] couldn't cache the answer:", error.message);
  return place ? { ok: true, place } : { ok: false, reason: "not-found" };
}
