/**
 * Pixel sprites as text grids. One character = one pixel.
 *   .  transparent
 *   X  currentColor (follows text color, so icons work on light and bezel)
 *   o  accent, var(--sprite-accent), defaults to lime
 *   w  screen white
 *   s  skin, H hair, e eyes, m mouth, S shirt (avatar art only)
 *
 * Avatar colors are illustration colors, not UI tokens, so they live here
 * and not in the theme.
 */

export const SPRITES = {
  home: ["...XX...", "..XXXX..", ".XXXXXX.", "XXXXXXXX", ".X....X.", ".X.XX.X.", ".X.XX.X.", ".XXXXXX."],
  search: [".XXXX...", "X....X..", "X....X..", "X....X..", ".XXXX...", "....XX..", ".....XX.", "......XX"],
  log: [".XXXXXX.", ".X....X.", ".X.XX.X.", ".X....X.", ".X.XX.X.", ".X....X.", ".X.XX.X.", ".XXXXXX."],
  tips: ["XXX..XXX", "X.XXXX.X", "X..XX..X", "X..XX..X", "X..XX..X", "X..XX..X", "XXXXXXXX", "........"],
  profile: ["..XXXX..", "..XXXX..", "..XXXX..", "...XX...", ".XXXXXX.", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX"],
  check: ["........", ".......X", "......XX", "X....XX.", "XX..XX..", ".XXXX...", "..XX....", "........"],
  plus: ["........", "...XX...", "...XX...", ".XXXXXX.", ".XXXXXX.", "...XX...", "...XX...", "........"],
  close: ["X......X", ".X....X.", "..X..X..", "...XX...", "...XX...", "..X..X..", ".X....X.", "X......X"],
  bookmark: [".XXXXXX.", ".X....X.", ".X....X.", ".X....X.", ".X....X.", ".X.XX.X.", ".XX..XX.", ".X....X."],
  bookmarkFilled: [".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XX..XX.", ".X....X."],
  external: ["....XXXX", "......XX", "XXX..X.X", "X...X..X", "X..X....", "X.X..X..", "X....X..", "XXXXXX.."],
  clock: ["..XXXX..", ".X..X.X.", "X...X..X", "X...XX.X", "X......X", "X......X", ".X....X.", "..XXXX.."],
  pin: ["..XXXX..", ".XXXXXX.", "XXX..XXX", "XXX..XXX", ".XXXXXX.", "..XXXX..", "...XX...", "...XX..."],
  chevronRight: ["..X.....", "..XX....", "...XX...", "....XX..", "....XX..", "...XX...", "..XX....", "..X....."],
  alert: ["...XX...", "..X..X..", "..X..X..", ".X.XX.X.", ".X.XX.X.", "X......X", "X..XX..X", "XXXXXXXX"],
  gear: ["..X..X..", ".XXXXXX.", "XX....XX", ".X.XX.X.", ".X.XX.X.", "XX....XX", ".XXXXXX.", "..X..X.."],
  trophy: ["XXXXXXXX", "X.XXXX.X", "X.XXXX.X", ".XXXXXX.", "..XXXX..", "...XX...", "..XXXX..", ".XXXXXX."],
  download: ["...XX...", "...XX...", "...XX...", "XX.XX.XX", ".XXXXXX.", "..XXXX..", "...XX...", "XXXXXXXX"],
  eye: ["........", "..XXXX..", ".X....X.", "X..XX..X", "X..XX..X", ".X....X.", "..XXXX..", "........"],
  star: ["...XX...", "..XooX..", "XXXooXXX", "XooooooX", ".XooooX.", ".XoXXoX.", "XoX..XoX", "XX....XX"],
  shield: ["XXXXXXXX", "XooooooX", "XoooXooX", "XooXXooX", "XoooXooX", ".XooXoX.", "..XooX..", "...XX..."],
  flame: ["...X....", "..XoX...", "..XooX.X", ".XooooXX", ".XoooooX", "XooXXooX", "XoX..XoX", ".XXXXXX."],
  chest: [
    "..XXXXXXXX..",
    ".XooooooooX.",
    "XooooooooooX",
    "XXXXXXXXXXXX",
    "XooooXXooooX",
    "XooooXXooooX",
    "XooooooooooX",
    "XooooooooooX",
    "XXXXXXXXXXXX",
  ],
  avatar: [
    "...HHHHHH...",
    "..HHHHHHHH..",
    ".HHssssssHH.",
    ".HsessssesH.",
    "..ssssssss..",
    "..sssmmsss..",
    "...ssssss...",
    "..SSSssSSS..",
    ".SSSSSSSSSS.",
    "SSSSSSSSSSSS",
    "SSSSSSSSSSSS",
    "SSSSSSSSSSSS",
  ],
} as const satisfies Record<string, readonly string[]>;

export type SpriteName = keyof typeof SPRITES;

const PALETTE: Record<string, string> = {
  X: "currentColor",
  o: "var(--sprite-accent, var(--color-lime))",
  w: "var(--color-screen)",
  s: "var(--sprite-skin, #c98f62)",
  H: "var(--sprite-hair, #1b1410)",
  e: "#1b1410",
  m: "#8a4b32",
  S: "var(--sprite-shirt, var(--color-lime))",
};

/** Avatar art presets (onboarding picks one of these). */
export const AVATAR_PRESETS = {
  skin: ["#f1c9a5", "#d9a77c", "#c98f62", "#a86b45", "#7a4a2e"],
  hair: ["#1b1410", "#4a2c1a", "#7a5230", "#2f3b45"],
} as const;

export type SpriteRect = { x: number; y: number; w: number; fill: string };

const cache = new Map<SpriteName, { width: number; height: number; rects: SpriteRect[] }>();

/** Converts a grid into horizontal runs, so each row draws as few rects as possible. */
export function spriteRects(name: SpriteName) {
  const hit = cache.get(name);
  if (hit) return hit;
  const grid = SPRITES[name];
  const rects: SpriteRect[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c === ".") {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === c) run++;
      rects.push({ x, y, w: run, fill: PALETTE[c] ?? "currentColor" });
      x += run;
    }
  });
  const out = { width: grid[0].length, height: grid.length, rects };
  cache.set(name, out);
  return out;
}
