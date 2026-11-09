import { describe, expect, it } from "vitest";
import { shouldPrompt, type PendingApply } from "@/components/listing/usePendingApply";
import { findCityById } from "@/lib/catalog/cities";
import { canonicalSkill } from "@/lib/catalog/skills";
import { picksQuery, readPicks, withQuery } from "@/lib/listings/picks";
import { toBreakdown } from "@/lib/listings/present";
import { scoreListing } from "@/lib/matching/score";
import { findSampleListing } from "@/lib/sample/listings";

describe("picks in the URL", () => {
  it("reads valid picks and drops junk", () => {
    const p = readPicks(new URLSearchParams("field=iot&skills=c,arduino,nope,c&city=quezon-city&remote=0"));
    expect(p.field).toBe("iot");
    expect(p.skills).toEqual(["c", "arduino"]);
    expect(p.city?.id).toBe("quezon-city");
    expect(p.remoteOk).toBe(false);
  });

  it("ignores unknown fields and cities", () => {
    const p = readPicks(new URLSearchParams("field=wizardry&city=atlantis"));
    expect(p.field).toBeNull();
    expect(p.city).toBeNull();
    expect(p.remoteOk).toBe(true);
  });

  it("round-trips and leaves defaults out", () => {
    const q = "field=web&skills=react%2Cgit&city=makati";
    expect(picksQuery(readPicks(new URLSearchParams(q)))).toBe(q);
    expect(picksQuery(readPicks(new URLSearchParams("")))).toBe("");
    expect(withQuery("/start", "")).toBe("/start");
    expect(withQuery("/start", "a=1")).toBe("/start?a=1");
  });
});

describe("Did you apply? prompt timing", () => {
  const p: PendingApply = { id: "x", title: "T", company: "C", clickedAt: 1_000_000, asked: false };

  it("asks after a real visit away, within 2 hours", () => {
    expect(shouldPrompt(p, p.clickedAt + 60_000, 30_000)).toBe(true);
  });

  it("does not ask after a quick tab switch", () => {
    expect(shouldPrompt(p, p.clickedAt + 3_000, 3_000)).toBe(false);
  });

  it("does not ask twice, or after 2 hours, or with no click", () => {
    expect(shouldPrompt({ ...p, asked: true }, p.clickedAt + 60_000, 30_000)).toBe(false);
    expect(shouldPrompt(p, p.clickedAt + 2 * 60 * 60 * 1000 + 1, 30_000)).toBe(false);
    expect(shouldPrompt(null, 0, 30_000)).toBe(false);
  });
});

describe("match breakdown wording", () => {
  const listing = findSampleListing("tanglaw-iot-firmware")!;
  const qc = findCityById("quezon-city");

  it("explains every part in plain words", () => {
    const m = scoreListing(
      { skills: ["c", "arduino"], fields: ["iot"], workType: null, location: qc, radiusKm: 25 },
      listing,
      canonicalSkill,
    );
    const b = toBreakdown(listing, m, qc);
    const byKey = Object.fromEntries(b.parts.map((p) => [p.key, p]));
    expect(byKey.skills.detail).toBe("2 of 3 required, 0 of 2 nice-to-have");
    expect(byKey.distance.detail).toMatch(/km from Quezon City$/);
    expect(byKey.interests.detail).toBe("IoT & Embedded is your field");
    expect(byKey.workType.score).toBeNull();
    expect(byKey.workType.detail).toMatch(/^Not counted/);
  });

  it("marks nice-to-have gaps so they don't read as requirements", () => {
    const m = scoreListing({ skills: ["c", "arduino", "sensors"], fields: [], workType: null, location: null, radiusKm: 25 }, listing);
    const names = toBreakdown(listing, m, null).missing.map((x) => x.name);
    expect(names).toEqual(["Soldering (nice to have)", "MQTT (nice to have)"]);
  });

  it("attaches at most 2 free resources per missing skill", () => {
    const m = scoreListing({ skills: ["c"], fields: [], workType: null, location: null, radiusKm: 25 }, listing);
    for (const x of toBreakdown(listing, m, null).missing) {
      expect(x.resources.length).toBeLessThanOrEqual(2);
    }
  });
});
