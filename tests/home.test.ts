import { describe, expect, it } from "vitest";
import { applyExp, unlockAt } from "@/lib/game/reward";
import { exploreListings } from "@/lib/listings/explore";
import { closingSoon } from "@/lib/listings/present";
import { SAMPLE_LISTINGS } from "@/lib/sample/listings";

describe("applyExp (display of a server-granted reward)", () => {
  it("adds EXP within a level", () => {
    expect(applyExp({ level: 4, exp: 100, expMax: 500 }, 20)).toEqual({ level: 4, exp: 120, expMax: 500, leveledUp: false });
  });

  it("rolls over into the next level", () => {
    expect(applyExp({ level: 4, exp: 480, expMax: 500 }, 20)).toEqual({ level: 5, exp: 0, expMax: 500, leveledUp: true });
    expect(applyExp({ level: 1, exp: 90, expMax: 100 }, 230)).toMatchObject({ level: 4, exp: 20, leveledUp: true });
  });

  it("ignores zero or negative amounts", () => {
    expect(applyExp({ level: 2, exp: 10, expMax: 100 }, 0)).toMatchObject({ level: 2, exp: 10, leveledUp: false });
    expect(applyExp({ level: 2, exp: 10, expMax: 100 }, -5)).toMatchObject({ level: 2, exp: 10, leveledUp: false });
  });

  it("names the Level 3 leaderboard unlock", () => {
    expect(unlockAt(3)).toBe("Weekly leaderboard");
    expect(unlockAt(4)).toBeNull();
  });
});

describe("closingSoon", () => {
  it("lists only saved, open listings closing within 7 days, soonest first", () => {
    const saved = ["kanto-social-media", "kalye-data-analyst", "sari-ux-design", "pinoy-games-art"];
    expect(closingSoon(SAMPLE_LISTINGS, saved).map((l) => l.id)).toEqual(["kanto-social-media", "kalye-data-analyst"]);
  });
});

describe("home matches", () => {
  it("leaves out listings already in the quest log", () => {
    const r = exploreListings(SAMPLE_LISTINGS, {
      skills: ["c", "arduino"],
      field: "iot",
      city: null,
      remoteOk: true,
      excludeIds: ["tanglaw-iot-firmware"],
    });
    expect(r.items.find((i) => i.id === "tanglaw-iot-firmware")).toBeUndefined();
  });

  it("uses the work type preference when there is one", () => {
    const base = { skills: ["c"], field: "iot" as const, city: null, remoteOk: true };
    const remote = exploreListings(SAMPLE_LISTINGS, { ...base, workType: "remote" });
    const none = exploreListings(SAMPLE_LISTINGS, base);
    const pct = (r: typeof none, id: string) => r.items.find((i) => i.id === id)?.match?.pct;
    // An onsite listing scores lower for someone who wants remote (fit 0) than for someone with no
    // preference (part not counted). Note: a 0.5 fit can *raise* a weak score, by design (decision #36).
    expect(pct(remote, "tanglaw-iot-firmware")!).toBeLessThan(pct(none, "tanglaw-iot-firmware")!);
  });
});
