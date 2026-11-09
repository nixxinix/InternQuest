import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Header for company and admin pages (W13, W14). The bezel stays as the brand
 * (wireframe decision 6), but there's no pixel font, HUD, or game words.
 */
export function BusinessHeader({ area, home, children }: { area: "for companies" | "admin"; home: string; children?: ReactNode }) {
  return (
    <header className="on-bezel">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-lime focus:px-3 focus:py-2 focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-x-3 px-gutter">
        <Link href={home} className="inline-flex min-h-tap items-center text-lg font-bold tracking-tight">
          <span>
            InternQuest <span className="text-base font-normal text-bezel-text">{area}</span>
          </span>
        </Link>
        {children && <nav aria-label="Account" className="flex items-center gap-1">{children}</nav>}
      </div>
    </header>
  );
}

export const HEADER_LINK =
  "inline-flex min-h-tap items-center px-3 text-sm font-semibold text-bezel-text underline-offset-4 hover:text-screen hover:underline";
