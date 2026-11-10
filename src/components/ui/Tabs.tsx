"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useGameMode } from "@/components/providers/GameModeProvider";
import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: string; count?: number };

type TabsProps = {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tab list, e.g. "Quest log status". */
  label: string;
  /** Renders the panel for the selected tab. */
  children: ReactNode;
};

/**
 * WAI-ARIA tabs with automatic activation: arrow keys, Home and End move
 * and select. Scrolls sideways on narrow screens instead of wrapping.
 */
export function Tabs({ tabs, value, onChange, label, children }: TabsProps) {
  const base = useId();
  const plain = useGameMode().mode === "plain";
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, tabs.findIndex((t) => t.id === value));

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === -1) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b-2 border-bezel">
        {tabs.map((t, i) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onKeyDown={onKeyDown}
              onClick={() => onChange(t.id)}
              className={cn(
                // Phones: equal-width tabs, count under the label, so 4 tabs fit at 360px.
                // From 640px: label and count side by side.
                "inline-flex min-h-tap min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1.5 py-1 text-sm font-semibold",
                "sm:flex-none sm:flex-row sm:gap-2 sm:px-3 sm:text-base",
                selected ? "bg-bezel text-screen [--focus:var(--color-ink)]" : "bg-screen text-ink hover:bg-line",
              )}
            >
              {t.label}
              {typeof t.count === "number" && (
                <span
                  className={cn(
                    // Pixel digits are a game detail: plain text in Plain mode and on company/admin pages.
                    "min-w-6 px-1 text-center",
                    plain ? "text-sm font-semibold" : "font-pixel text-hud-sm",
                    selected ? "bg-lime text-ink" : "bg-canvas text-ink",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${value}`} tabIndex={0} className="pt-4">
        {children}
      </div>
    </div>
  );
}
