"use client";

import { cn } from "@/lib/cn";
import { useFeatures, useReducedMotion } from "@/components/providers/GameModeProvider";
import { SegmentBar } from "@/components/ui/SegmentBar";
import { useCountUp } from "./useCountUp";

type ExpBarProps = {
  /** EXP earned inside the current level. */
  exp: number;
  /** EXP needed to finish the current level. */
  max: number;
  level: number;
  surface?: "bezel" | "light";
  /** Smaller bar for the collapsed header. */
  compact?: boolean;
  className?: string;
};

/**
 * Level progress. Hidden in Plain mode. Counts up only in Full Quest with
 * motion allowed; Light mode just fills the bar.
 */
export function ExpBar({ exp, max, level, surface = "bezel", compact = false, className }: ExpBarProps) {
  const features = useFeatures();
  const reduced = useReducedMotion();
  const shown = useCountUp(exp, features.expCountUp && !reduced, 600);

  if (!features.exp) return null;

  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="progressbar"
        aria-label={`Level ${level} progress`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={exp}
        aria-valuetext={`${exp} of ${max} EXP`}
      >
        <SegmentBar
          value={shown}
          max={max}
          segments={compact ? 12 : 20}
          surface={surface}
          height={compact ? "sm" : "md"}
          stagger={!reduced}
        />
      </div>
      {!compact && (
        <p aria-hidden="true" className="mt-1 font-pixel text-hud-sm uppercase">
          <span className={surface === "bezel" ? "text-lime" : "text-green"}>{shown}</span>
          <span className={surface === "bezel" ? "text-bezel-text" : "text-muted"}> / {max} EXP</span>
        </p>
      )}
    </div>
  );
}
