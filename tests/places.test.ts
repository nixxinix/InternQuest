import { describe, expect, it } from "vitest";
import { cityIdFromRow, validateProfileInput } from "@/lib/account/account";
import { cityLabel, findCatalogCity, findCityById, geoCityId, isGeoCityId } from "@/lib/catalog/cities";
import { isPlaceQuery, nominatimUrl, normalizePlaceQuery, parseNominatim } from "@/lib/geo/nominatim";
import { readPicks, picksQuery } from "@/lib/listings/picks";
import { profileErrors } from "@/lib/profile/validate";

const BASE = {
  look: { skin: "#c98f62", hair: "#1b1410" },
  field: "iot" as const,
  skills: ["c"],
  cityId: null as string | null,
  workType: null,
  status: null,
  school: null as string | null,
};

describe("found places as city ids", () => {
  it("round-trips a place found on the map, rounded to about 1 km", () => {
    const id = geoCityId("Antipolo, Rizal", 14.58634, 121.17611);
    expect(id).toBe("@14.59,121.18:Antipolo, Rizal");
    expect(isGeoCityId(id)).toBe(true);
    expect(findCityById(id)).toEqual({ id, name: "Antipolo", province: "Rizal", lat: 14.59, lng: 121.18 });
    expect(cityLabel(findCityById(id))).toBe("Antipolo, Rizal");
  });

  it("refuses places outside the Philippines and malformed ids", () => {
    expect(findCityById(geoCityId("Tokyo", 35.68, 139.69))).toBeNull();
    for (const bad of ["@14.6,121.0", "@abc,121:Pasig", "@14.123,121:Pasig", "@14.6,121.0:"]) expect(findCityById(bad), bad).toBeNull();
  });

  it("works in shared links like a listed city", () => {
    const city = findCityById(geoCityId("Lipa, Batangas", 13.94, 121.16));
    const q = picksQuery({ field: "iot", skills: ["c"], city, remoteOk: true });
    expect(readPicks(new URLSearchParams(q)).city).toEqual(city);
  });

  it("tells a listed city from another town with the same name", () => {
    expect(findCatalogCity("San Juan")?.province).toBe("Metro Manila");
    expect(findCatalogCity("San Juan, Metro Manila")?.id).toBe("san-juan");
    expect(findCatalogCity("San Juan, Batangas")).toBeNull();
    // Saved rows: a catalog city only when the saved location is near it.
    expect(cityIdFromRow("Pasig", 14.58, 121.09)).toBe("pasig");
    expect(cityIdFromRow("San Juan, Batangas", 13.83, 121.4)).toBe("@13.83,121.4:San Juan, Batangas");
    expect(cityIdFromRow(null, null, null)).toBeNull();
  });
});

describe("Nominatim lookups", () => {
  it("normalizes queries so one cache entry covers small spelling differences", () => {
    expect(normalizePlaceQuery("  Stá.  Rosa ")).toBe("sta. rosa");
    expect(isPlaceQuery("QC")).toBe(true);
    expect(isPlaceQuery("1")).toBe(false);
    expect(isPlaceQuery("12345")).toBe(false);
    expect(isPlaceQuery("x".repeat(81))).toBe(false);
  });

  it("asks for one Philippine result, in English, as JSON", () => {
    const url = new URL(nominatimUrl("Lipa City"));
    expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/search");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ q: "Lipa City", countrycodes: "ph", limit: "1", format: "jsonv2" });
  });

  it("names a city with its province, and a district with its city", () => {
    expect(parseNominatim([{ lat: "13.9411", lon: "121.1631", name: "Lipa", address: { city: "Lipa", province: "Batangas" } }])).toEqual({
      name: "Lipa, Batangas",
      lat: 13.94,
      lng: 121.16,
    });
    expect(parseNominatim([{ lat: "14.6197", lon: "121.0525", name: "Cubao", address: { suburb: "Cubao", city: "Quezon City" } }])).toEqual({
      name: "Cubao, Quezon City",
      lat: 14.62,
      lng: 121.05,
    });
  });

  it("returns nothing for empty, broken, or foreign answers", () => {
    expect(parseNominatim([])).toBeNull();
    expect(parseNominatim({ error: "x" })).toBeNull();
    expect(parseNominatim([{ lat: "x", lon: "121" }])).toBeNull();
    expect(parseNominatim([{ lat: "35.68", lon: "139.69", name: "Tokyo" }])).toBeNull();
  });
});

describe("city choice when saving a profile", () => {
  const city = (input: object) => {
    const r = validateProfileInput({ ...BASE, ...input });
    return r.ok ? r.city : r.error;
  };

  it("uses our list, then a place found earlier, then a new lookup", () => {
    expect(city({ cityText: "" })).toEqual({ kind: "none" });
    expect(city({ cityText: "quezon city" })).toEqual({ kind: "known", name: "Quezon City", lat: 14.68, lng: 121.04 });
    const earlier = geoCityId("Lipa, Batangas", 13.94, 121.16);
    expect(city({ cityId: earlier, cityText: "Lipa, Batangas" })).toEqual({ kind: "known", name: "Lipa, Batangas", lat: 13.94, lng: 121.16 });
    // Changed text: the old id doesn't count any more.
    expect(city({ cityId: earlier, cityText: "Tanauan" })).toEqual({ kind: "lookup", text: "Tanauan" });
  });

  it("refuses text that can't be a place name", () => {
    expect(city({ cityText: "12345" })).toMatch(/city or town/);
  });

  it("still accepts the older form that sends only an id", () => {
    expect(city({ cityId: "pasig" })).toMatchObject({ kind: "known", name: "Pasig" });
    expect(city({ cityId: "atlantis" })).toMatch(/don't know/);
  });

  it("saves 'my school isn't listed' and 'not in school' as no school", () => {
    for (const school of ["not-listed", "not-in-school"]) {
      const r = validateProfileInput({ ...BASE, school, cityText: "" });
      expect(r.ok && r.update.school_id, school).toBeNull();
    }
  });

  it("lets the form accept any place name only when the map lookup is available", () => {
    const values = { ...BASE, field: "iot" as const };
    expect(profileErrors(values, "Lipa").city).toMatch(/don't know/);
    expect(profileErrors(values, "Lipa", { anyPlace: true }).city).toBeUndefined();
    expect(profileErrors(values, "123", { anyPlace: true }).city).toMatch(/city or town/);
  });
});
