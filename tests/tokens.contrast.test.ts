import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AA, contrastRatio, readColorTokens } from "@/lib/design/contrast";

// Reads the real token file, so the test always checks what the app ships.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const tokens = readColorTokens(css);

const CORE = ["bezel", "canvas", "screen", "ink", "muted", "lime", "green", "alert"];

/** [text, background]: every text color on every background it is used on. */
const TEXT_PAIRS: Array<[string, string]> = [
  ["ink", "screen"],
  ["ink", "canvas"],
  ["ink", "line"], // Quick prep hover
  ["muted", "screen"],
  ["muted", "canvas"],
  ["green", "screen"],
  ["green", "canvas"],
  ["alert", "screen"],
  ["alert", "canvas"],
  ["alert", "alert-tint"],
  ["ink", "alert-tint"],
  ["screen", "green"],
  ["screen", "green-press"],
  ["screen", "alert"],
  ["screen", "bezel"],
  ["bezel-text", "bezel"],
  ["bezel-text", "bezel-raised"],
  ["lime", "bezel"],
  ["lime", "bezel-raised"],
  ["ink", "lime"],
  ["green", "green-tint"],
  ["ink", "green-tint"],
  ["muted", "green-tint"],
];

/** [part, background]: control borders, focus rings, and lit vs. unlit segments. */
const UI_PAIRS: Array<[string, string]> = [
  ["muted", "screen"], // input borders
  ["alert", "screen"], // invalid input border
  ["ink", "canvas"], // focus ring on light
  ["lime", "bezel"], // focus ring on bezel
  ["green", "screen"], // selected chip
  ["green", "line"], // lit vs. unlit segment on light
  ["lime", "bezel-track"], // lit vs. unlit segment on bezel
];

describe("design tokens", () => {
  it("defines the 8 core color tokens as hex", () => {
    for (const name of CORE) {
      expect(tokens[name], `--color-${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(TEXT_PAIRS)("%s text on %s meets WCAG AA (4.5:1)", (fg, bg) => {
    expect(tokens[fg], `--color-${fg} missing`).toBeDefined();
    expect(tokens[bg], `--color-${bg} missing`).toBeDefined();
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(AA.text);
  });

  it.each(UI_PAIRS)("%s on %s meets the 3:1 minimum for UI parts", (fg, bg) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(AA.ui);
  });

  it("documents why lime is bezel-only: it is unreadable on light surfaces", () => {
    expect(contrastRatio(tokens.lime, tokens.screen)).toBeLessThan(AA.ui);
    expect(contrastRatio(tokens.lime, tokens.canvas)).toBeLessThan(AA.ui);
  });
});
