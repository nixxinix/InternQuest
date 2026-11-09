"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { PixelIcon } from "@/components/ui/PixelIcon";
import type { SpriteName } from "@/components/ui/sprites";

type BadgeProps = {
  name: string;
  sprite: SpriteName;
  earned: boolean;
  /** How to earn it (shown on locked badges) or what it was for. */
  description: string;
};

/**
 * Earned badges sit on the bezel in full color. Locked badges are dashed,
 * grey, and say "Locked" in text, so the state never depends on color.
 */
export function Badge({ name, sprite, earned, description }: BadgeProps) {
  const features = useFeatures();
  if (!features.badges) return null;

  return (
    <figure
      className={cn(
        "flex w-36 flex-col items-center gap-2 p-3 text-center",
        earned ? "on-bezel" : "border-2 border-dashed border-muted bg-canvas text-muted",
      )}
    >
      {/* Earned: lime outline with a dark fill, so every sprite shows on the bezel
          (a sprite with no accent pixels drawn in ink would be invisible there). */}
      <PixelIcon
        name={sprite}
        scale={5}
        className={earned ? "text-lime" : "text-muted"}
        style={
          {
            "--sprite-accent": earned ? "var(--color-bezel-raised)" : "var(--color-line)",
          } as CSSProperties
        }
      />
      <figcaption>
        <span className={cn("block font-pixel text-hud-sm uppercase", earned ? "text-lime" : "text-ink")}>
          {name}
        </span>
        <span className={cn("mt-1 block text-xs", earned ? "text-bezel-text" : "text-muted")}>
          {earned ? description : `Locked · ${description}`}
        </span>
      </figcaption>
    </figure>
  );
}
