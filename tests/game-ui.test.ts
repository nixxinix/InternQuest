import { describe, expect, it } from "vitest";
import { GAME_MODES, isGameMode, modeFeatures, vocab } from "@/lib/game/mode";
import { fraction, litSegments, matchLabel, percent } from "@/lib/game/progress";
import { nextStepHint } from "@/lib/tracker/status";

describe("game modes", () => {
  it("validates mode values", () => {
    expect(GAME_MODES.every(isGameMode)).toBe(true);
    expect(isGameMode("hard")).toBe(false);
    expect(isGameMode(undefined)).toBe(false);
  });

  it("uses game words only in Full Quest", () => {
    expect(vocab("full", "missingSkills")).toBe("Missing abilities");
    expect(vocab("light", "missingSkills")).toBe("Missing skills");
    expect(vocab("plain", "missingSkills")).toBe("Missing skills");
    expect(vocab("plain", "tracker")).toBe("Applications");
    expect(vocab("light", "tracker")).toBe("Quest log");
  });

  it("Plain mode turns every game feature off", () => {
    expect(Object.values(modeFeatures("plain")).every((on) => on === false)).toBe(true);
  });

  it("Light mode keeps only EXP and badges (SPEC §10)", () => {
    const f = modeFeatures("light");
    expect(f.exp && f.badges).toBe(true);
    expect(f.avatar || f.streak || f.weeklyQuest || f.levelUpScreen || f.leaderboard || f.expCountUp).toBe(false);
  });
});

describe("progress math", () => {
  it("clamps fractions and handles bad input", () => {
    expect(fraction(50, 100)).toBe(0.5);
    expect(fraction(150, 100)).toBe(1);
    expect(fraction(-5, 100)).toBe(0);
    expect(fraction(5, 0)).toBe(0);
    expect(fraction(Number.NaN, 100)).toBe(0);
    expect(percent(1, 3)).toBe(33);
  });

  it("lights segments: none at 0, at least one for any progress, all only when full", () => {
    expect(litSegments(0, 500, 20)).toBe(0);
    expect(litSegments(1, 500, 20)).toBe(1);
    expect(litSegments(340, 500, 20)).toBe(13);
    expect(litSegments(499, 500, 20)).toBe(19);
    expect(litSegments(500, 500, 20)).toBe(20);
    expect(litSegments(86, 100, 10)).toBe(8);
    expect(litSegments(10, 100, 0)).toBe(0);
  });

  it("labels match levels in words", () => {
    expect(matchLabel(86)).toBe("Strong match");
    expect(matchLabel(72)).toBe("Good match");
    expect(matchLabel(41)).toBe("Partial match");
    expect(matchLabel(12)).toBe("Stretch");
  });
});

describe("quest log hints", () => {
  it("points Interview cards to interview tips (SPEC §8)", () => {
    expect(nextStepHint("interview")?.href).toBe("/tips/interview");
  });

  it("gives no hint for quiet outcomes", () => {
    expect(nextStepHint("result", "no_reply")).toBeNull();
    expect(nextStepHint("result", "withdrew")).toBeNull();
  });
});
