"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { LevelUpDialog } from "@/components/game/LevelUpDialog";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { useToast } from "@/components/ui/Toast";
import { applyExp, unlockAt } from "@/lib/game/reward";

type Progress = { level: number; exp: number; expMax: number };

/**
 * Shows a reward the server granted, the same way on every screen:
 * - Full Quest: a level-up card when the level changes (and no toast on top, decision #6),
 * - otherwise a toast. The toast shows "+N EXP" only in modes with EXP.
 *
 * Phase 3: `amount` comes back from the server action. The client never decides EXP.
 * Render `levelUpDialog` once in the screen.
 */
export function useReward<V extends Progress>(viewer: V, setViewer: Dispatch<SetStateAction<V>>) {
  const f = useFeatures();
  const toast = useToast();
  const [levelUp, setLevelUp] = useState<number | null>(null);

  const reward = (amount: number, message: string, patch?: (v: V) => V) => {
    const next = applyExp(viewer, amount);
    setViewer((v0) => {
      const updated = { ...v0, level: next.level, exp: next.exp, expMax: next.expMax };
      return patch ? patch(updated) : updated;
    });
    if (next.leveledUp && f.levelUpScreen) {
      setLevelUp(next.level);
      return;
    }
    toast({
      message: next.leveledUp && f.exp ? `${message} You reached Level ${next.level}.` : message,
      tone: "success",
      exp: amount > 0 ? amount : undefined,
    });
  };

  const levelUpDialog = (
    <LevelUpDialog
      open={levelUp !== null}
      level={levelUp ?? viewer.level}
      unlocked={levelUp ? unlockAt(levelUp) : null}
      onClose={() => setLevelUp(null)}
    />
  );

  return { reward, levelUpDialog };
}
