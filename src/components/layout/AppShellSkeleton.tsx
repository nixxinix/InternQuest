import type { ReactNode } from "react";

/**
 * Loading frame for logged-in screens: same sidebar, header, and main column
 * sizes as AppShell, so nothing jumps when the real screen arrives.
 */
export function AppShellSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15rem_minmax(0,1fr)]" aria-busy="true">
      <div className="on-bezel hidden lg:block" />
      <div>
        <div className="on-bezel h-20 lg:hidden" />
        <main className="mx-auto w-full max-w-6xl px-gutter pt-5 lg:px-10 lg:pt-8">
          <p className="sr-only">{label}</p>
          <div aria-hidden="true">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-shimmer bg-line ${className}`} />;
}
