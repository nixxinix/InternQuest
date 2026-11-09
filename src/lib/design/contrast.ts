/**
 * WCAG 2.1 contrast helpers. Pure functions, used by the token tests.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

export type Rgb = { r: number; g: number; b: number };

/** Parses #rgb or #rrggbb (case-insensitive). Throws on anything else. */
export function hexToRgb(hex: string): Rgb {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex color: "${hex}"`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colors, from 1 to 21. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA minimums. Normal text 4.5, large text and UI parts 3. */
export const AA = { text: 4.5, largeText: 3, ui: 3 } as const;

/**
 * Reads `--color-name: #hex;` declarations from a CSS string.
 * Only plain hex values are returned (keywords like `transparent` are skipped).
 */
export function readColorTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const re = /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    tokens[m[1]] = m[2].toLowerCase();
  }
  return tokens;
}
