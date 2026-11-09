import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShellSkeleton, SkeletonBlock } from "@/components/layout/AppShellSkeleton";
import { SearchScreen } from "@/components/search/SearchScreen";
import { ListingCardSkeleton } from "@/components/ui/ListingCard";

export const metadata: Metadata = {
  title: "Search",
  // Results depend on the signed-in user's profile: never indexed.
  robots: { index: false, follow: false },
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton label="Loading listings">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="mt-4 h-12" />
          <div className="mt-3 flex gap-2">
            <SkeletonBlock className="h-11 w-32" />
            <SkeletonBlock className="h-11 w-32" />
            <SkeletonBlock className="h-11 w-28" />
          </div>
          <div className="mt-6 grid gap-3 lg:max-w-[calc(100%-26rem)]">
            <ListingCardSkeleton />
            <ListingCardSkeleton />
            <ListingCardSkeleton />
          </div>
        </AppShellSkeleton>
      }
    >
      <SearchScreen />
    </Suspense>
  );
}
