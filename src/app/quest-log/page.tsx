import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShellSkeleton, SkeletonBlock } from "@/components/layout/AppShellSkeleton";
import { QuestLogScreen } from "@/components/questlog/QuestLogScreen";

export const metadata: Metadata = {
  title: "Quest log",
  // Personal page: never indexed.
  robots: { index: false, follow: false },
};

export default function QuestLogPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton label="Loading your quest log">
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="mt-4 h-12 lg:hidden" />
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="hidden h-40 lg:block" />
            <SkeletonBlock className="hidden h-40 lg:block" />
          </div>
        </AppShellSkeleton>
      }
    >
      <QuestLogScreen />
    </Suspense>
  );
}
