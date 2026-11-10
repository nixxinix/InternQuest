import { describe, expect, it } from "vitest";
import { findCityByName } from "@/lib/catalog/cities";
import { searchSkills } from "@/lib/catalog/skills";
import { exploreListings } from "@/lib/listings/explore";
import { allowanceText, deadlineText, postedText } from "@/lib/listings/present";
import { SAMPLE_LISTINGS, isClosed } from "@/lib/sample/listings";

describe("card wording", () => {
  it("only shows deadlines that are close", () => {
    expect(deadlineText(null)).toBeNull();
    expect(deadlineText(-1)).toBe("Closed");
    expect(deadlineText(0)).toBe("Closes today");
    expect(deadlineText(1)).toBe("1 day left");
    expect(deadlineText(14)).toBe("14 days left");
    expect(deadlineText(30)).toBeNull();
  });

  it("words posting age", () => {
    expect(postedText(0)).toBe("Posted today");
    expect(postedText(1)).toBe("Posted yesterday");
    expect(postedText(5)).toBe("Posted 5 days ago");
    expect(postedText(20)).toBe("Posted 2 weeks ago");
  });

  it("joins allowance and hours", () => {
    expect(allowanceText("₱500/day", 486)).toBe("₱500/day · 486 hrs");
    expect(allowanceText(null, null)).toBeNull();
    expect(allowanceText("Unpaid", null)).toBe("Unpaid");
  });
});

describe("catalog lookups", () => {
  it("finds cities ignoring case, accents, and a province suffix", () => {
    expect(findCityByName("quezon city")?.id).toBe("quezon-city");
    expect(findCityByName("Las Pinas")?.id).toBe("las-pinas");
    expect(findCityByName("Cebu City, Cebu")?.id).toBe("cebu-city");
    expect(findCityByName("Atlantis")).toBeNull();
  });

  it("searches skills by alias", () => {
    expect(searchSkills("excel").map((s) => s.id)).toContain("ms-excel");
    expect(searchSkills("js").map((s) => s.id)).toContain("javascript");
  });
});

describe("exploreListings", () => {
  const base = { skills: [], field: null, city: null, remoteOk: true } as const;

  it("shows newest first, with no match, before any skill is picked", () => {
    const r = exploreListings(SAMPLE_LISTINGS, { ...base, skills: [] });
    expect(r.mode).toBe("newest");
    expect(r.items.every((i) => i.match === null)).toBe(true);
    expect(r.items).toHaveLength(SAMPLE_LISTINGS.filter((l) => !isClosed(l)).length);
  });

  it("never shows closed listings", () => {
    const r = exploreListings(SAMPLE_LISTINGS, { ...base, skills: ["illustration", "photoshop"] });
    expect(r.items.find((i) => i.id === "pinoy-games-art")).toBeUndefined();
  });

  it("puts the picked field first when there are no skills yet", () => {
    const r = exploreListings(SAMPLE_LISTINGS, { ...base, skills: [], field: "hospitality" });
    expect(r.items[0].id).toBe("hiraya-front-office");
  });

  it("ranks by match once skills are picked", () => {
    const r = exploreListings(SAMPLE_LISTINGS, { ...base, skills: ["c", "arduino", "sensors"], field: "iot" });
    expect(r.mode).toBe("match");
    const pcts = r.items.map((i) => i.match?.pct ?? -1);
    expect(pcts).toEqual([...pcts].sort((a, b) => b - a));
    expect(r.items[0].id).toBe("tanglaw-iot-firmware");
  });

  it("keeps missing required skills apart from missing nice-to-haves", () => {
    const r = exploreListings(SAMPLE_LISTINGS, { ...base, skills: ["c", "arduino", "sensors"] });
    const tanglaw = r.items.find((i) => i.id === "tanglaw-iot-firmware");
    expect(tanglaw?.match?.missing).toEqual([]);
    expect(tanglaw?.match?.missingNice).toEqual(["Soldering", "MQTT"]);
  });

  it("counts what the remote and distance filters hide", () => {
    const davao = findCityByName("Davao City");
    const r = exploreListings(SAMPLE_LISTINGS, { ...base, skills: [], city: davao, remoteOk: false });
    expect(r.hiddenByRemote).toBe(SAMPLE_LISTINGS.filter((l) => l.workType === "remote").length);
    expect(r.items.map((i) => i.id)).toEqual(["matibay-civil"]);
    expect(r.hiddenByDistance).toBeGreaterThan(0);
  });
});
