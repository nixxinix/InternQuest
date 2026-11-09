import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { SAMPLE_LISTINGS, findSampleListing } from "@/lib/sample/listings";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicSupabase } from "@/lib/supabase/server";
import { manilaDate } from "@/lib/tracker/log";
import { LISTING_COLUMNS, listingFromRow, type Listing, type ListingRow } from "./listing";

/**
 * Listings are public, so they're read with the public key and cached for a
 * few minutes (tag "listings"; admin imports and the daily refresh will
 * revalidate it). Without Supabase keys, the design-preview samples are used.
 *
 * Search and matching run in the browser over this list, which is fine for a
 * pilot of a few hundred listings. Phase 5 (JSearch) moves the filtering to
 * the database when the list grows.
 */
export const LISTING_LIMIT = 500;

function mapRows(rows: ListingRow[]): Listing[] {
  const now = new Date();
  const today = manilaDate(now);
  return rows.map((r) => listingFromRow(r, today, now)).filter((l): l is Listing => l !== null);
}

/** Open listings, newest first. */
export async function getOpenListings(): Promise<Listing[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  if (!isSupabaseConfigured()) return SAMPLE_LISTINGS;

  const { data, error } = await createPublicSupabase()
    .from("internships")
    .select(LISTING_COLUMNS)
    .eq("is_active", true)
    .order("posted_at", { ascending: false })
    .limit(LISTING_LIMIT)
    .overrideTypes<ListingRow[], { merge: false }>();
  if (error) throw new Error(`Couldn't load listings: ${error.message}`);
  return mapRows(data ?? []);
}

/** One listing, open or closed (old links show "This listing is closed"). */
export async function getListing(id: string): Promise<Listing | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings", `listing:${id}`);
  if (!isSupabaseConfigured()) return findSampleListing(id);
  if (!/^[a-z0-9-]{3,80}$/.test(id)) return null;

  const { data, error } = await createPublicSupabase()
    .from("internships")
    .select(LISTING_COLUMNS)
    .eq("id", id)
    .maybeSingle<ListingRow>();
  if (error) throw new Error(`Couldn't load the listing: ${error.message}`);
  return data ? (mapRows([data])[0] ?? null) : null;
}

/** Ids to prerender at build time; the rest render on first visit. */
export async function getListingIds(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("listings");
  if (!isSupabaseConfigured()) return SAMPLE_LISTINGS.map((l) => l.id);
  const { data, error } = await createPublicSupabase()
    .from("internships")
    .select("id")
    .eq("is_active", true)
    .order("posted_at", { ascending: false })
    .limit(50)
    .overrideTypes<{ id: string }[], { merge: false }>();
  if (error) throw new Error(`Couldn't load listing ids: ${error.message}`);
  return (data ?? []).map((r) => r.id);
}
