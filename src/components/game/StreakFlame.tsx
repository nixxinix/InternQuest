"use client";

import { useFeatures } from "@/components/providers/GameModeProvider";
import { PixelIcon } from "@/components/ui/PixelIcon";

type StreakFlameProps = {
  weeks: number;
  /** One rest week per month keeps the streak alive (SPEC §10). */
  restWeekAvailable: boolean;
};

/**
 * Full Quest only. Flickers twice when the week count changes (none with reduced motion).
 * "stack" (flame over text) for the phone header; "inline" for tight rows like the sidebar.
 */
export function StreakFlame({ weeks, restWeekAvailable, variant = "stack" }: StreakFlameProps & { variant?: "stack" | "inline" }) {
  const features = useFeatures();
  // Hidden until there's a streak to show: a "0 wk" flame reads as failing (SPEC §10: never shame;
  // streaks also only unlock after week 1).
  if (!features.streak || weeks < 1) return null;

  const label = `Weekly streak: ${weeks} ${weeks === 1 ? "week" : "weeks"}${
    restWeekAvailable ? ". Rest week available this month." : "."
  }`;

  return (
    <div
      role="img"
      aria-label={label}
      className={variant === "stack" ? "flex flex-col items-center text-lime" : "flex items-center gap-1 text-lime"}
    >
      <PixelIcon key={weeks} name="flame" scale={variant === "stack" ? 3 : 2} className="animate-flicker" />
      <span className={variant === "stack" ? "mt-0.5 whitespace-nowrap font-pixel text-hud-sm uppercase" : "whitespace-nowrap font-pixel text-hud-sm uppercase"}>
        {weeks} wk
      </span>
    </div>
  );
}
