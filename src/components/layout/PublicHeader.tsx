import Link from "next/link";
import { Suspense } from "react";
import { HeaderAccountLink, LoginLink } from "./HeaderAccountLink";

/** Logged-out header on the bezel. No game elements: visitors haven't chosen a play style. */
export function PublicHeader({ skipTo = "main" }: { skipTo?: string }) {
  return (
    <header className="on-bezel">
      <a
        href={`#${skipTo}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-lime focus:px-3 focus:py-2 focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-gutter">
        <Link href="/" className="inline-flex min-h-tap items-center font-pixel text-hud uppercase">
          InternQuest
        </Link>
        <nav aria-label="Account" className="flex items-center gap-1">
          <Link
            href="/companies"
            className="hidden min-h-tap items-center px-3 text-sm font-semibold text-bezel-text underline-offset-4 hover:text-screen hover:underline sm:inline-flex"
          >
            For companies
          </Link>
          <Suspense fallback={<LoginLink />}>
            <HeaderAccountLink />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
