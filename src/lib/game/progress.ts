/**
 * Pure helpers for segmented bars (EXP bar, match bar, quest pips).
 * Display math only. EXP itself is always calculated on the server.
 */

/** Clamps value/max to a 0..1 fraction. Returns 0 for invalid input. */
export function fraction(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/** Whole percent, 0..100. */
export function percent(value: number, max: number): number {
  return Math.round(fraction(value, max) * 100);
}

/**
 * How many of `segments` blocks are lit. Rounds down, so a bar only looks
 * full when the value is really full, but any progress above 0 lights at
 * least one block (so a new user sees that something happened).
 */
export function litSegments(value: number, max: number, segments: number): number {
  if (segments <= 0) return 0;
  const f = fraction(value, max);
  if (f === 0) return 0;
  if (f >= 1) return segments;
  return Math.max(1, Math.floor(f * segments));
}

/** Words for a match percentage, so the meaning never depends on the bar alone. */
export function matchLabel(pct: number): "Strong match" | "Good match" | "Partial match" | "Stretch" {
  if (pct >= 80) return "Strong match";
  if (pct >= 60) return "Good match";
  if (pct >= 40) return "Partial match";
  return "Stretch";
}
