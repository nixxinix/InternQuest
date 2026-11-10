import { ImageResponse } from "next/og";
import { SPRITES } from "@/components/ui/sprites";

/**
 * The app icon: the map pin sprite in lime on the bezel color (DESIGN_SYSTEM:
 * lime only ever sits on the bezel). Drawn as square pixels, so it stays crisp
 * at every size. The pin fills the middle half, inside the "maskable" safe
 * zone, so Android can crop it to a circle or squircle without cutting it.
 */
const BEZEL = "#16202a";
const LIME = "#a6f05a";

export function appIcon(size: number): ImageResponse {
  const grid = SPRITES.pin;
  const cells = grid.length; // 8 x 8
  const px = Math.floor((size * 0.5) / cells);
  const art = px * cells;
  const offset = Math.floor((size - art) / 2);

  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: BEZEL, display: "flex", position: "relative" }}>
        {grid.flatMap((row, y) =>
          [...row].map((c, x) =>
            c === "X" ? (
              <div
                key={`${x}-${y}`}
                style={{ position: "absolute", left: offset + x * px, top: offset + y * px, width: px, height: px, background: LIME }}
              />
            ) : null,
          ),
        )}
      </div>
    ),
    { width: size, height: size },
  );
}
