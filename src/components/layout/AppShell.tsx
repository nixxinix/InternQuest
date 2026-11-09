"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, type AvatarLook } from "@/components/game/Avatar";
import { ExpBar } from "@/components/game/ExpBar";
import { HudHeader } from "@/components/game/HudHeader";
import { StreakFlame } from "@/components/game/StreakFlame";
import { useFeatures, useVocab } from "@/components/providers/GameModeProvider";
import { BottomNav, type NavKey } from "@/components/ui/BottomNav";
import { PixelIcon } from "@/components/ui/PixelIcon";
import type { SpriteName } from "@/components/ui/sprites";
import { cn } from "@/lib/cn";

export type ShellViewer = {
  username: string;
  look: AvatarLook;
  level: number;
  exp: number;
  expMax: number;
  streakWeeks: number;
  restWeekAvailable: boolean;
};

type ShellNavKey = NavKey | "leaderboard" | "settings";

/**
 * Frame for every logged-in intern screen (W0).
 * Phones: HUD header on top, bottom nav at the bottom.
 * Desktop (lg): 240px left sidebar with the character summary and nav, no top bar.
 * Must be rendered inside GameModeProvider (company/admin screens never use it).
 */
export function AppShell({
  active,
  viewer,
  children,
  bottomNav = true,
}: {
  active: ShellNavKey;
  viewer: ShellViewer;
  children: ReactNode;
  /** Child pages like a guide hide the phone bottom nav and show a back link instead (wireframe decision 2). */
  bottomNav?: boolean;
}) {
  return (
    <div data-shell="" className="lg:grid lg:min-h-dvh lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-lime focus:px-3 focus:py-2 focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <AppSidebar active={active} viewer={viewer} />
      <div className="flex min-h-dvh flex-col">
        <div className="no-print lg:hidden">
          <HudHeader {...viewer} />
        </div>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 scroll-mt-4 px-gutter pb-10 pt-5 lg:px-10 lg:pt-8">
          {children}
        </main>
        {bottomNav && (
          <div className="no-print contents">
            <BottomNav active={active === "leaderboard" || active === "settings" ? "profile" : active} />
          </div>
        )}
      </div>
    </div>
  );
}

function AppSidebar({ active, viewer }: { active: ShellNavKey; viewer: ShellViewer }) {
  const f = useFeatures();
  const v = useVocab();
  const items: { key: ShellNavKey; href: string; label: string; icon: SpriteName; show: boolean }[] = [
    { key: "home", href: "/home", label: "Home", icon: "home", show: true },
    { key: "search", href: "/search", label: "Search", icon: "search", show: true },
    { key: "tracker", href: "/quest-log", label: v("tracker"), icon: "log", show: true },
    { key: "tips", href: "/tips", label: "Tips", icon: "tips", show: true },
    // Leaderboard: Full Quest only, unlocked at Level 3 (SPEC §10).
    { key: "leaderboard", href: "/leaderboard", label: "Leaderboard", icon: "trophy", show: f.leaderboard && viewer.level >= 3 },
    { key: "profile", href: "/profile", label: v("profile"), icon: "profile", show: true },
    { key: "settings", href: "/settings", label: "Settings", icon: "gear", show: true },
  ];

  return (
    <aside className="no-print on-bezel sticky top-0 hidden h-dvh flex-col overflow-y-auto lg:flex" aria-label="Sidebar">
      <div className="px-5 pb-4 pt-5">
        <Link href="/home" className="font-pixel text-hud uppercase">
          InternQuest
        </Link>
      </div>

      {f.exp && (
        <div className="mx-3 mb-4 bg-bezel-raised p-3">
          {f.avatar && (
            <div className="mb-3 flex items-center gap-3">
              <Avatar look={viewer.look} scale={4} label={`${viewer.username}'s avatar`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" title={viewer.username}>
                  {viewer.username}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-pixel text-hud-sm uppercase text-bezel-text">
                    Lv <span className="text-hud text-lime">{viewer.level}</span>
                  </p>
                  <StreakFlame weeks={viewer.streakWeeks} restWeekAvailable={viewer.restWeekAvailable} variant="inline" />
                </div>
              </div>
            </div>
          )}
          {!f.avatar && (
            <p className="mb-2 font-pixel text-hud-sm uppercase text-bezel-text">
              Lv <span className="text-hud text-lime">{viewer.level}</span>
            </p>
          )}
          <ExpBar exp={viewer.exp} max={viewer.expMax} level={viewer.level} compact={false} />
        </div>
      )}

      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-1">
          {items
            .filter((it) => it.show)
            .map((it) => {
              const current = it.key === active;
              return (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-tap items-center gap-3 border-l-4 px-3 text-base",
                      current
                        ? "border-lime bg-bezel-raised font-semibold text-lime"
                        : "border-transparent text-bezel-text hover:bg-bezel-raised hover:text-screen",
                    )}
                  >
                    <PixelIcon name={it.icon} scale={3} />
                    {it.label}
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>
      <p className="px-5 py-4 text-xs text-bezel-text">Signed in as {viewer.username}</p>
    </aside>
  );
}
