import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeScreen } from "@/components/home/HomeScreen";
import { AppShellSkeleton, SkeletonBlock } from "@/components/layout/AppShellSkeleton";

export const metadata: Metadata = {
  title: "Home",
  // Personal page: never indexed.
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton label="Loading your home page">
          <div className="space-y-4">
            <SkeletonBlock className="h-8 w-1/2" />
            <SkeletonBlock className="h-28" />
            <SkeletonBlock className="h-48" />
            <SkeletonBlock className="h-48" />
          </div>
        </AppShellSkeleton>
      }
    >
      <HomeScreen />
    </Suspense>
  );
}
