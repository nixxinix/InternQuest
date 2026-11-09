"use client";

import { useFeatures } from "@/components/providers/GameModeProvider";
import { Avatar, type AvatarLook } from "./Avatar";
import { ExpBar } from "./ExpBar";
import { StreakFlame } from "./StreakFlame";

type HudHeaderProps = {
  username: string;
  look: AvatarLook;
  level: number;
  exp: number;
  expMax: number;
  streakWeeks: number;
  restWeekAvailable: boolean;
};

/**
 * The console bezel at the top of every intern screen.
 * Full: avatar, name, level, EXP, streak. Light: wordmark, level, EXP.
 * Plain: wordmark only. The bezel itself stays in every mode (decision #11).
 */
export function HudHeader({ username, look, level, exp, expMax, streakWeeks, restWeekAvailable }: HudHeaderProps) {
  const f = useFeatures();

  return (
    <header className="on-bezel">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-gutter py-3">
        {f.avatar && <Avatar look={look} scale={4} label={`${username}'s avatar`} />}
        {/* On wide screens the EXP block keeps a readable width instead of spanning the page. */}
        <div className="min-w-0 flex-1 lg:max-w-sm">
          <div className="flex items-baseline justify-between gap-2">
            {f.avatar ? (
              <span className="truncate font-semibold">{username}</span>
            ) : (
              <span className="font-pixel text-hud uppercase">InternQuest</span>
            )}
            {f.exp && (
              <span className="font-pixel text-hud-sm uppercase text-bezel-text">
                Lv <span className="text-hud text-lime">{level}</span>
              </span>
            )}
          </div>
          {f.exp && <ExpBar exp={exp} max={expMax} level={level} className="mt-1.5" />}
        </div>
        <div className="lg:ml-auto">
          <StreakFlame weeks={streakWeeks} restWeekAvailable={restWeekAvailable} />
        </div>
      </div>
    </header>
  );
}
