/**
 * OpenStreetMap Nominatim, the map lookup for typed places (SPEC §5.2).
 * Pure helpers (request building and answer parsing), unit tested. The
 * network call, caching, and throttling live in src/lib/geo/geocode.ts.
 *
 * Usage policy (operations.osmfoundation.org/policies/nominatim):
 *  - at most 1 request per second, from the whole app;
 *  - an identifying User-Agent (NOMINATIM_USER_AGENT);
 *  - results cached, no autocomplete (we look up once, when a profile is saved);
 *  - attribution to OpenStreetMap where results are used.
 */
import { isInPhilippines } from "@/lib/catalog/cities";

export const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
export const OSM_ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright";

/** Lowercase, single spaces, no accents: one cache entry for "Sta. Rosa", "sta. rosa ", "Stá. Rosa". */
export function normalizePlaceQuery(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** A sensible query: 2 to 80 characters with at least one letter. */
export function isPlaceQuery(text: string): boolean {
  const q = text.trim();
  return q.length >= 2 && q.length <= 80 && /\p{L}/u.test(q);
}

export function nominatimUrl(query: string): string {
  const params = new URLSearchParams({
    q: query.trim(),
    format: "jsonv2",
    countrycodes: "ph",
    addressdetails: "1",
    limit: "1",
    "accept-language": "en",
  });
  return `${NOMINATIM_ENDPOINT}?${params}`;
}

export type FoundPlace = { name: string; lat: number; lng: number };

type NominatimAddress = Partial<
  Record<"city" | "town" | "municipality" | "village" | "suburb" | "quarter" | "neighbourhood" | "province" | "state" | "region", string>
>;
type NominatimResult = { lat?: string; lon?: string; name?: string; address?: NominatimAddress };

/**
 * The first result as "Place, Province" (or "Area, City" for a district such
 * as Cubao), with the location rounded to 2 decimals (about 1 km). Null when
 * nothing usable came back or it's outside the Philippines.
 */
export function parseNominatim(json: unknown): FoundPlace | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const r = json[0] as NominatimResult;
  const lat = Number(r?.lat);
  const lng = Number(r?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInPhilippines(lat, lng)) return null;

  const a = r.address ?? {};
  const city = a.city ?? a.town ?? a.municipality;
  const area = a.suburb ?? a.quarter ?? a.neighbourhood ?? a.village;
  const province = a.province ?? a.state ?? a.region;
  const main = (r.name || city || area || "").trim();
  if (!main) return null;
  // A district gets its city for context; a city gets its province.
  const context = city && city !== main ? city : province && province !== main ? province : null;
  const name = (context ? `${main}, ${context}` : main).slice(0, 80);

  const round = (x: number) => Math.round(x * 100) / 100;
  return { name, lat: round(lat), lng: round(lng) };
}
