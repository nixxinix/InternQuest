import { describe, expect, it } from "vitest";
import { findCityById } from "@/lib/catalog/cities";
import {
  DEFAULT_FILTERS,
  activeFilters,
  isPaid,
  normalizeText,
  readSearchFilters,
  searchListings,
  searchQuery,
  withoutFilter,
  type SearchProfile,
} from "@/lib/listings/search";
import { SAMPLE_LISTINGS } from "@/lib/sample/listings";

const params = (qs: string) => new URLSearchParams(qs);
const noCity: SearchProfile = { skills: ["c", "arduino", "sensors", "python"], fields: ["iot"], workType: "hybrid", city: null };
const qc: SearchProfile = { ...noCity, city: findCityById("quezon-city") };
const ids = (r: ReturnType<typeof searchListings>) => r.items.map((i) => i.id);

describe("search filters in the URL", () => {
  it("reads defaults from an empty query", () => {
    expect(readSearchFilters(params(""))).toEqual(DEFAULT_FILTERS);
  });

  it("ignores values it doesn't know, so a bad link still works", () => {
    const f = readSearchFilters(params("radius=7&type=space&sort=random&posted=3&field=nope"));
    expect(f.radiusKm).toBe(DEFAULT_FILTERS.radiusKm);
    expect(f.workType).toBeNull();
    expect(f.sort).toBe("match");
    expect(f.postedWithinDays).toBeNull();
    expect(f.field).toBeNull();
  });

  it("caps the text query length", () => {
    expect(readSearchFilters(params(`q=${"a".repeat(200)}`)).q).toHaveLength(80);
  });

  it("round-trips through the query string and leaves defaults out", () => {
    const qs = "q=data&field=data&radius=10&type=onsite&paid=1&moa=1&posted=7&sort=deadline";
    expect(searchQuery(readSearchFilters(params(qs)))).toBe(qs);
    expect(searchQuery(DEFAULT_FILTERS)).toBe("");
  });

  it("counts radius as a filter only when the user has a city", () => {
    const f = { ...DEFAULT_FILTERS, radiusKm: 10 };
    expect(activeFilters(f, false)).toEqual([]);
    expect(activeFilters(f, true)).toEqual(["radius"]);
    expect(activeFilters(withoutFilter(f, "radius"), true)).toEqual([]);
  });
});

describe("searchListings", () => {
  it("never shows closed listings", () => {
    const r = searchListings(SAMPLE_LISTINGS, noCity, DEFAULT_FILTERS);
    expect(ids(r)).not.toContain("pinoy-games-art");
    expect(r.total).toBe(SAMPLE_LISTINGS.length - 1);
  });

  it("matches every word, ignoring case and accents", () => {
    expect(normalizeText("Parañaque")).toBe("paranaque");
    const r = searchListings(SAMPLE_LISTINGS, noCity, { ...DEFAULT_FILTERS, q: "DATA pasig" });
    expect(ids(r)).toEqual(["kalye-data-analyst"]);
  });

  it("treats 'With allowance' as paid and 'Unpaid' or unknown as not", () => {
    expect(isPaid("With allowance")).toBe(true);
    expect(isPaid("₱500/day")).toBe(true);
    expect(isPaid("Unpaid")).toBe(false);
    expect(isPaid(null)).toBe(false);
  });

  it("says how many listings each active filter removed", () => {
    const all = searchListings(SAMPLE_LISTINGS, noCity, DEFAULT_FILTERS).total;
    const r = searchListings(SAMPLE_LISTINGS, noCity, { ...DEFAULT_FILTERS, paid: true });
    expect(ids(r)).not.toContain("kanto-social-media");
    expect(r.removedBy.paid).toBe(all - r.total);
    expect(r.removedBy.moa).toBeUndefined();
  });

  it("applies the radius around the user's city, keeping remote listings", () => {
    const r = searchListings(SAMPLE_LISTINGS, qc, { ...DEFAULT_FILTERS, radiusKm: 10 });
    expect(ids(r)).toContain("tanglaw-iot-firmware"); // Cubao, about 6 km from the city's center point
    expect(ids(r)).toContain("sari-ux-design"); // remote
    expect(ids(r)).not.toContain("hiraya-front-office"); // Cebu
    expect(r.removedBy.radius).toBeGreaterThan(0);
  });

  it("hides remote listings when asked, unless Remote is the picked work type", () => {
    const off = searchListings(SAMPLE_LISTINGS, noCity, { ...DEFAULT_FILTERS, remote: false });
    expect(off.items.every((i) => i.workType !== "remote")).toBe(true);
    const remoteType = searchListings(SAMPLE_LISTINGS, noCity, { ...DEFAULT_FILTERS, remote: false, workType: "remote" });
    expect(remoteType.items.length).toBeGreaterThan(0);
    expect(remoteType.items.every((i) => i.workType === "remote")).toBe(true);
  });

  it("sorts by best match, newest, or closing soonest", () => {
    const best = searchListings(SAMPLE_LISTINGS, qc, DEFAULT_FILTERS);
    const pcts = best.items.map((i) => i.match?.pct ?? 0);
    expect(pcts).toEqual([...pcts].sort((a, b) => b - a));

    const soonest = searchListings(SAMPLE_LISTINGS, noCity, { ...DEFAULT_FILTERS, sort: "deadline" });
    expect(soonest.items[0].id).toBe("kanto-social-media"); // 2 days left
    expect(soonest.items.at(-1)?.deadlineText).toBeFalsy(); // no deadline goes last
  });

  it("falls back to newest when there are no skills to match on", () => {
    const r = searchListings(SAMPLE_LISTINGS, { ...noCity, skills: [] }, DEFAULT_FILTERS);
    expect(r.sortUsed).toBe("newest");
    expect(r.items[0].match).toBeNull();
    expect(r.items[0].id).toBe("sari-ux-design"); // posted 1 day ago
  });
});
