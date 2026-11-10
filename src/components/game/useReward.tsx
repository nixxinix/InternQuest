"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { LevelUpDialog } from "@/components/game/LevelUpDialog";
import { LIVE } from "@/components/providers/AccountProvider";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { useToast } from "@/components/ui/Toast";
import { BADGES } from "@/lib/game/badges";
import type { ServerReward } from "@/lib/game/exp";
import { applyExp, unlockAt } from "@/lib/game/reward";

type Progress = { level: number; exp: number; expMax: number };

/**
 * Shows rewards the same way on every screen:
 * - Full Quest: a level-up card when the level changes (and no toast on top, decision #6),
 * - otherwise a toast. The toast shows "+N EXP" only in modes with EXP.
 *
 * Real accounts: `fromServer` shows exactly what the server granted (amount,
 * level, badges). The browser never decides EXP (CLAUDE.md hard rule).
 * Design preview: `reward` animates a sample amount.
 * Render `levelUpDialog` once in the screen.
 */
export function useReward<V extends Progress>(viewer: V, setViewer: Dispatch<SetStateAction<V>>) {
  const f = useFeatures();
  const toast = useToast();
  const [levelUp, setLevelUp] = useState<number | null>(null);

  /** Real accounts: show the server's reward (or just the message when nothing was granted). */
  const fromServer = (r: ServerReward | null | undefined, message: string, patch?: (v: V) => V) => {
    setViewer((v0) => {
      let updated = v0;
      if (r) {
        const p = r.progress;
        updated = {
          ...v0,
          level: p.level,
          exp: p.exp,
          expMax: p.expMax,
          // The rest of the viewer, when the screen's viewer has these fields.
          ...("totalExp" in v0
            ? { totalExp: p.totalExp, streakWeeks: p.streakWeeks, restWeekAvailable: p.restWeekAvailable, badges: r.badges, weeklyQuest: p.weeklyQuest }
            : {}),
        };
      }
      return patch ? patch(updated) : updated;
    });
    const badgeNames = (r?.newBadges ?? []).map((id) => BADGES.find((b) => b.id === id)?.name ?? id);
    const withBadges = badgeNames.length && f.badges ? `${message} New badge: ${badgeNames.join(", ")}.` : message;
    if (r?.leveledUp && f.levelUpScreen) {
      setLevelUp(r.progress.level);
      return;
    }
    toast({
      message: r?.leveledUp && f.exp ? `${withBadges} You reached Level ${r.progress.level}.` : withBadges,
      tone: "success",
      exp: r && r.amount > 0 ? r.amount : undefined,
    });
  };

  /** Design preview: animates a sample amount. Real accounts: only the message (use fromServer). */
  const reward = (amount: number, message: string, patch?: (v: V) => V) => {
    if (LIVE) {
      fromServer(null, message, patch);
      return;
    }
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

  return { reward, fromServer, levelUpDialog };
}
