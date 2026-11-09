import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, readColorTokens, relativeLuminance } from "@/lib/design/contrast";

describe("hexToRgb", () => {
  it("parses 6- and 3-digit hex", () => {
    expect(hexToRgb("#0b6e42")).toEqual({ r: 11, g: 110, b: 66 });
    expect(hexToRgb("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("rejects non-hex input", () => {
    expect(() => hexToRgb("lime")).toThrow();
    expect(() => hexToRgb("#12345")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
    // #767676 on white is the classic "just passes AA" gray.
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  it("does not depend on argument order", () => {
    expect(contrastRatio("#16202a", "#a6f05a")).toBeCloseTo(contrastRatio("#a6f05a", "#16202a"), 10);
  });

  it("orders luminance from black to white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });
});

describe("readColorTokens", () => {
  it("reads hex color declarations and skips keywords", () => {
    const css = `@theme { --color-ink: #121A21; --color-current: currentColor; --text-sm: 1rem; }`;
    expect(readColorTokens(css)).toEqual({ ink: "#121a21" });
  });
});
