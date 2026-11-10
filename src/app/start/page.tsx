import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingRoot } from "@/components/onboarding/Onboarding";
import { AccountScope } from "@/components/providers/AccountScope";
import { ListingsScope } from "@/components/providers/ListingsScope";

export const metadata: Metadata = {
  title: "Create your character",
  description: "Make a free InternQuest account with just a username and password.",
};

export default function StartPage() {
  return (
    <AccountScope>
      <ListingsScope>
        <Suspense fallback={<StartSkeleton />}>
          <OnboardingRoot />
        </Suspense>
      </ListingsScope>
    </AccountScope>
  );
}

function StartSkeleton() {
  return (
    <>
      <div className="on-bezel h-14" />
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-gutter pt-6" aria-busy="true">
        <p className="sr-only">Loading</p>
        <div aria-hidden="true" className="space-y-4">
          <div className="h-8 w-2/3 animate-shimmer bg-line" />
          <div className="h-4 w-full animate-shimmer bg-line" />
          <div className="h-11 w-full animate-shimmer bg-line" />
          <div className="h-11 w-full animate-shimmer bg-line" />
          <div className="h-12 w-full animate-shimmer bg-line" />
        </div>
      </main>
    </>
  );
}
