/**
 * Local city list for autocomplete (decision: no Nominatim autocomplete,
 * which its usage policy forbids). SAMPLE ONLY: approximate city-center
 * coordinates for design and testing. Phase 1 replaces this with a full
 * PSGC-based import of cities and municipalities.
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

export function findCityById(id: string | null | undefined): City | null {
  if (!id) return null;
  return CITIES.find((c) => c.id === id) ?? null;
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
