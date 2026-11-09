"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useVocab } from "@/components/providers/GameModeProvider";
import { PixelIcon } from "./PixelIcon";
import type { SpriteName } from "./sprites";

export type NavKey = "home" | "search" | "tracker" | "tips" | "profile";

/** Mobile bottom nav on the bezel. Hidden from 1024px up, where the left sidebar takes over (Step 4). */
export function BottomNav({ active }: { active: NavKey }) {
  const v = useVocab();
  const items: { key: NavKey; href: string; label: string; icon: SpriteName }[] = [
    { key: "home", href: "/home", label: "Home", icon: "home" },
    { key: "search", href: "/search", label: "Search", icon: "search" },
    { key: "tracker", href: "/quest-log", label: v("tracker"), icon: "log" },
    { key: "tips", href: "/tips", label: "Tips", icon: "tips" },
    { key: "profile", href: "/profile", label: v("profile"), icon: "profile" },
  ];

  return (
    <nav aria-label="Main" className="on-bezel sticky bottom-0 z-40 lg:hidden">
      <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {items.map((it) => {
          const current = it.key === active;
          return (
            <li key={it.key}>
              <Link
                href={it.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-15 flex-col items-center justify-center gap-1 text-xs",
                  current ? "font-semibold text-lime" : "text-bezel-text hover:text-screen",
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
  );
}
