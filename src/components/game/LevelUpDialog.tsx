"use client";

import { useEffect, useId, useRef } from "react";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { Button } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";

type LevelUpDialogProps = {
  open: boolean;
  level: number;
  /** What the new level unlocks, e.g. "Weekly leaderboard". */
  unlocked?: string | null;
  onClose: () => void;
};

/**
 * Full Quest only. Light mode shows a toast instead; Plain shows nothing.
 * Uses the native <dialog>: focus is trapped, Escape closes it, and focus
 * returns to where it was. Skippable with Continue, Escape, or a tap outside.
 * Callers must queue it until any open sheet or form is closed (decision #6).
 */
export function LevelUpDialog({ open, level, unlocked, onClose }: LevelUpDialogProps) {
  const features = useFeatures();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const enabled = features.levelUpScreen;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && enabled && !dialog.open) dialog.showModal();
    if ((!open || !enabled) && dialog.open) dialog.close();
  }, [open, enabled]);

  if (!enabled) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto w-[min(20rem,calc(100%-2rem))] bg-transparent p-2 text-screen"
    >
      <div className="on-bezel animate-pop px-6 py-7 text-center px-frame-raised [--frame:var(--color-lime)]">
        <p className="font-pixel text-hud uppercase text-lime">Level up!</p>
        <PixelIcon name="star" scale={8} className="mx-auto mt-4" />
        <h2 id={titleId} className="mt-4 font-pixel text-hud-xl uppercase">
          LV {level}
        </h2>
        <p className="mt-3 text-base text-bezel-text">
          {unlocked ? (
            <>
              Unlocked: <strong className="text-screen">{unlocked}</strong>
            </>
          ) : (
            "Nice work. Keep going at your own pace."
          )}
        </p>
        <Button variant="hud" block className="mt-6" autoFocus onClick={() => ref.current?.close()}>
          Continue
        </Button>
      </div>
    </dialog>
  );
}
