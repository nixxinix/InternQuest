import { Suspense } from "react";
import { LandingExplorer, LandingExplorerSkeleton } from "@/components/landing/LandingExplorer";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

/**
 * W1 Landing (logged out). The 5-second test: the headline says what this
 * is, and real listings are on screen before any sign-up.
 */
export default function LandingPage() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-gutter pb-12 pt-5 lg:pt-10">
        <h1 className="max-w-2xl text-2xl font-semibold lg:text-3xl">
          Internships and OJT near you, matched to your skills.
        </h1>
        <p className="mt-1 text-base text-muted">No sign-up needed to look around.</p>
        <Suspense fallback={<LandingExplorerSkeleton />}>
          <LandingExplorer />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
