import { describe, expect, it } from "vitest";
import { canonicalSkill } from "@/lib/catalog/skills";
import {
  DEFAULT_RADIUS_KM,
  MATCH_WEIGHTS,
  REMOTE_DISTANCE_SCORE,
  WORK_TYPE_SCORE,
} from "@/lib/matching/config";
import { haversineKm } from "@/lib/matching/geo";
import {
  distanceScore,
  isInRange,
  scoreListing,
  skillScore,
  type MatchProfile,
  type MatchableListing,
} from "@/lib/matching/score";

const QC = { lat: 14.676, lng: 121.0437 };

const profile = (over: Partial<MatchProfile> = {}): MatchProfile => ({
  skills: [],
  fields: [],
  workType: null,
  location: null,
  radiusKm: DEFAULT_RADIUS_KM,
  ...over,
});

const listing = (over: Partial<MatchableListing> = {}): MatchableListing => ({
  field: "iot",
  workType: "onsite",
  location: QC,
  skills: [
    { id: "c", required: true },
    { id: "arduino", required: true },
    { id: "mqtt", required: false },
  ],
  ...over,
});

describe("config", () => {
  it("weights add up to 1 and follow SPEC §7", () => {
    const sum = Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(MATCH_WEIGHTS).toEqual({ skills: 0.5, distance: 0.25, interests: 0.15, workType: 0.1 });
  });

  it("work type fit is symmetric", () => {
    for (const a of ["onsite", "hybrid", "remote"] as const) {
      for (const b of ["onsite", "hybrid", "remote"] as const) {
        expect(WORK_TYPE_SCORE[a][b]).toBe(WORK_TYPE_SCORE[b][a]);
      }
    }
  });
});

describe("haversineKm", () => {
  it("measures one degree of longitude at the equator as about 111.2 km", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.19, 1);
  });

  it("is zero for the same point and symmetric", () => {
    expect(haversineKm(QC, QC)).toBe(0);
    const makati = { lat: 14.5547, lng: 121.0244 };
    expect(haversineKm(QC, makati)).toBeCloseTo(haversineKm(makati, QC), 10);
  });
});

describe("skillScore", () => {
  it("weighs required skills 2 and nice-to-have 1", () => {
    const r = skillScore(["c", "mqtt"], listing().skills);
    expect(r.score).toBeCloseTo((2 + 1) / 5, 10);
    expect(r.matched).toEqual(["c", "mqtt"]);
    expect(r.missing).toEqual([{ id: "arduino", required: true }]);
  });

  it("lists required skills first", () => {
    const r = skillScore([], listing().skills);
    expect(r.missing.map((m) => m.id)).toEqual(["c", "arduino", "mqtt"]);
  });

  it("treats synonyms as the same skill (IoT = embedded systems)", () => {
    const skills = [{ id: "embedded-systems", required: true }];
    expect(skillScore(["iot"], skills).score).toBe(0);
    expect(skillScore(["iot"], skills, canonicalSkill).score).toBe(1);
  });

  it("returns null when the listing asks for no skills", () => {
    expect(skillScore(["c"], []).score).toBeNull();
  });
});

describe("distanceScore", () => {
  it("is 1.0 within 5 km and decays to 0 at the radius", () => {
    expect(distanceScore(0, 25)).toBe(1);
    expect(distanceScore(5, 25)).toBe(1);
    expect(distanceScore(15, 25)).toBeCloseTo(0.5, 10);
    expect(distanceScore(25, 25)).toBe(0);
    expect(distanceScore(40, 25)).toBe(0);
  });
});

describe("scoreListing", () => {
  it("combines all four parts with the configured weights", () => {
    const r = scoreListing(
      profile({ skills: ["c", "arduino", "mqtt"], fields: ["iot"], workType: "hybrid", location: QC }),
      listing(),
    );
    // skills 1, distance 1 (same spot), field 1, work type hybrid->onsite 0.5
    expect(r.score).toBeCloseTo(0.5 + 0.25 + 0.15 + 0.1 * 0.5, 10);
    expect(r.pct).toBe(95);
    expect(r.distanceKm).toBe(0);
  });

  it("gives remote listings a fixed distance score", () => {
    const r = scoreListing(profile({ location: QC }), listing({ workType: "remote", location: null }));
    expect(r.parts.distance.score).toBe(REMOTE_DISTANCE_SCORE);
    expect(r.distanceKm).toBeNull();
  });

  it("leaves out parts it has no data for and scales the rest up", () => {
    // Only skills are known: no city, no field, no work type preference.
    const r = scoreListing(profile({ skills: ["c", "mqtt"] }), listing());
    expect(r.parts.distance.score).toBeNull();
    expect(r.parts.interests.score).toBeNull();
    expect(r.parts.workType.score).toBeNull();
    expect(r.score).toBeCloseTo(3 / 5, 10);
  });

  it("returns a JSON-safe breakdown for the UI", () => {
    const r = scoreListing(profile({ skills: ["c"] }), listing());
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    expect(Object.keys(r.parts)).toEqual(["skills", "distance", "interests", "workType"]);
  });

  it("scores 0 when nothing at all can be measured", () => {
    const r = scoreListing(profile(), listing({ skills: [] }));
    expect(r.score).toBe(0);
  });
});

describe("isInRange", () => {
  const davao = { lat: 7.1907, lng: 125.4553 };
  it("keeps nearby and remote listings, drops far ones", () => {
    expect(isInRange(profile({ location: QC }), listing())).toBe(true);
    expect(isInRange(profile({ location: QC }), listing({ location: davao }))).toBe(false);
    expect(isInRange(profile({ location: QC }), listing({ workType: "remote", location: null }))).toBe(true);
  });

  it("keeps everything when the user has no location", () => {
    expect(isInRange(profile(), listing({ location: davao }))).toBe(true);
  });
});
