import type { CSSProperties } from "react";
import { spriteRects, type SpriteName } from "./sprites";

type PixelIconProps = {
  name: SpriteName;
  /** Integer scale only, so pixels stay crisp. 3 = 24px for an 8px sprite. */
  scale?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
  /** Give a label only when the icon carries meaning on its own. Otherwise it is hidden from screen readers. */
  label?: string;
  className?: string;
  style?: CSSProperties;
};

export function PixelIcon({ name, scale = 3, label, className, style }: PixelIconProps) {
  const { width, height, rects } = spriteRects(name);
  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      className={className}
      style={{ flex: "none", ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
