/**
 * Local city list for autocomplete (decision: no Nominatim autocomplete,
 * which its usage policy forbids). Approximate city-center coordinates.
 * Signed-in users can also type any other city, town, or area: the server
 * looks it up on the map once, when the profile is saved (src/lib/geo).
 */
import type { LatLng } from "@/lib/matching/geo";

export type City = { id: string; name: string; province: string } & LatLng;

export const CITIES: City[] = [
  { id: "quezon-city", name: "Quezon City", province: "Metro Manila", lat: 14.676, lng: 121.0437 },
  { id: "manila", name: "Manila", province: "Metro Manila", lat: 14.5995, lng: 120.9842 },
  { id: "makati", name: "Makati", province: "Metro Manila", lat: 14.5547, lng: 121.0244 },
  { id: "taguig", name: "Taguig", province: "Metro Manila", lat: 14.5176, lng: 121.0509 },
  { id: "pasig", name: "Pasig", province: "Metro Manila", lat: 14.5764, lng: 121.0851 },
  { id: "mandaluyong", name: "Mandaluyong", province: "Metro Manila", lat: 14.5794, lng: 121.0359 },
  { id: "san-juan", name: "San Juan", province: "Metro Manila", lat: 14.6019, lng: 121.0355 },
  { id: "marikina", name: "Marikina", province: "Metro Manila", lat: 14.6507, lng: 121.1029 },
  { id: "caloocan", name: "Caloocan", province: "Metro Manila", lat: 14.6507, lng: 120.9671 },
  { id: "valenzuela", name: "Valenzuela", province: "Metro Manila", lat: 14.7011, lng: 120.983 },
  { id: "pasay", name: "Pasay", province: "Metro Manila", lat: 14.5378, lng: 121.0014 },
  { id: "paranaque", name: "Parañaque", province: "Metro Manila", lat: 14.4793, lng: 121.0198 },
  { id: "las-pinas", name: "Las Piñas", province: "Metro Manila", lat: 14.4445, lng: 120.9939 },
  { id: "muntinlupa", name: "Muntinlupa", province: "Metro Manila", lat: 14.4081, lng: 121.0415 },
  { id: "antipolo", name: "Antipolo", province: "Rizal", lat: 14.5878, lng: 121.176 },
  { id: "calamba", name: "Calamba", province: "Laguna", lat: 14.2117, lng: 121.1653 },
  { id: "santa-rosa", name: "Santa Rosa", province: "Laguna", lat: 14.3122, lng: 121.1114 },
  { id: "dasmarinas", name: "Dasmariñas", province: "Cavite", lat: 14.3294, lng: 120.9367 },
  { id: "angeles", name: "Angeles", province: "Pampanga", lat: 15.145, lng: 120.5887 },
  { id: "baguio", name: "Baguio", province: "Benguet", lat: 16.4023, lng: 120.596 },
  { id: "cebu-city", name: "Cebu City", province: "Cebu", lat: 10.3157, lng: 123.8854 },
  { id: "iloilo-city", name: "Iloilo City", province: "Iloilo", lat: 10.7202, lng: 122.5621 },
  { id: "bacolod", name: "Bacolod", province: "Negros Occidental", lat: 10.6765, lng: 122.9509 },
  { id: "cagayan-de-oro", name: "Cagayan de Oro", province: "Misamis Oriental", lat: 8.4542, lng: 124.6319 },
  { id: "davao-city", name: "Davao City", province: "Davao del Sur", lat: 7.1907, lng: 125.4553 },
];

/**
 * A city or area may also be one found on the map (Nominatim). Those use an id
 * that carries the rounded location and the name, "@14.59,121.18:Antipolo, Rizal",
 * so every place that reads a city id (profile, URL picks) handles both kinds.
 */
const GEO_ID = /^@(-?\d{1,2}(?:\.\d{1,2})?),(-?\d{1,3}(?:\.\d{1,2})?):(.{1,80})$/;

/** Roughly the Philippines, with a margin. Places outside it aren't accepted. */
export function isInPhilippines(lat: number, lng: number): boolean {
  return lat >= 4 && lat <= 21.5 && lng >= 116 && lng <= 127.5;
}

export function geoCityId(name: string, lat: number, lng: number): string {
  const round = (x: number) => Math.round(x * 100) / 100;
  return `@${round(lat)},${round(lng)}:${name.trim().slice(0, 80)}`;
}

export function isGeoCityId(id: string): boolean {
  return GEO_ID.test(id);
}

function decodeGeoCity(id: string): City | null {
  const m = GEO_ID.exec(id);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  const name = m[3].trim();
  if (!name || !isInPhilippines(lat, lng)) return null;
  const [place, ...rest] = name.split(",");
  return { id, name: place.trim(), province: rest.join(",").trim(), lat, lng };
}

export function findCityById(id: string | null | undefined): City | null {
  if (!id) return null;
  if (id.startsWith("@")) return decodeGeoCity(id);
  return CITIES.find((c) => c.id === id) ?? null;
}

/** "Antipolo" or "Antipolo, Rizal": what to show in a city box. */
export function cityLabel(city: City | null): string {
  if (!city) return "";
  return city.id.startsWith("@") && city.province ? `${city.name}, ${city.province}` : city.name;
}

/** Matches a typed name, ignoring case, accents (ñ/n), and a trailing ", Province". */
export function findCityByName(text: string): City | null {
  const norm = (s: string) =>
    s
      .split(",")[0]
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  const q = norm(text);
  if (!q) return null;
  return CITIES.find((c) => norm(c.name) === q) ?? null;
}

/**
 * Stricter than findCityByName, for the server: when a province is given it
 * must match too, so "San Juan, Batangas" isn't taken for San Juan, Metro Manila.
 */
export function findCatalogCity(text: string): City | null {
  const city = findCityByName(text);
  if (!city) return null;
  const province = text.split(",").slice(1).join(",").trim();
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return province && norm(province) !== norm(city.province) ? null : city;
}
