import type { CSSProperties } from "react";
import { PixelIcon } from "@/components/ui/PixelIcon";

export type AvatarLook = {
  skin: string;
  hair: string;
  /** Defaults to lime. */
  shirt?: string;
};

/** Pixel avatar (12x12 sprite). Integer scales only: 4 = 48px, 8 = 96px. */
export function Avatar({ look, scale = 4, label }: { look: AvatarLook; scale?: 3 | 4 | 6 | 8; label?: string }) {
  const style = {
    "--sprite-skin": look.skin,
    "--sprite-hair": look.hair,
    "--sprite-shirt": look.shirt ?? "var(--color-lime)",
  } as CSSProperties;
  return <PixelIcon name="avatar" scale={scale} label={label} style={style} />;
}
