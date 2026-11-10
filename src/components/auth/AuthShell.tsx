import Link from "next/link";
import type { ReactNode } from "react";
import { PixelIcon } from "@/components/ui/PixelIcon";

/**
 * Frame for the logged-out account pages (log in, reset password). Same
 * header as onboarding; no game elements, since no play style is chosen yet.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="on-bezel">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-lime focus:px-3 focus:py-2 focus:font-semibold focus:text-ink"
        >
          Skip to content
        </a>
        <div className="mx-auto flex min-h-14 max-w-lg items-center px-gutter">
          <Link href="/" className="inline-flex min-h-tap items-center font-pixel text-hud uppercase">
            InternQuest
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-gutter pb-16 pt-8">
        {children}
      </main>
    </>
  );
}

/** Error banner at the top of an account form, announced when it appears. */
export function FormError({ message, id }: { message: string; id?: string }) {
  return (
    <div id={id} role="alert" className="mt-5 flex items-start gap-2 border-l-4 border-alert bg-alert-tint p-3 text-base">
      <PixelIcon name="alert" scale={2} className="mt-1 flex-none text-alert" />
      <span>{message}</span>
    </div>
  );
}

export function AuthSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <p className="sr-only">Loading</p>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-8 w-1/2 animate-shimmer bg-line" />
        <div className="h-4 w-3/4 animate-shimmer bg-line" />
        <div className="h-11 w-full animate-shimmer bg-line" />
        <div className="h-11 w-full animate-shimmer bg-line" />
        <div className="h-12 w-full animate-shimmer bg-line" />
      </div>
    </div>
  );
}
