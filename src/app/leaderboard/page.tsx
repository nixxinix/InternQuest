import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardScreen } from "@/components/leaderboard/LeaderboardScreen";
import { AppShellSkeleton, SkeletonBlock } from "@/components/layout/AppShellSkeleton";

export const metadata: Metadata = {
  title: "Leaderboard",
  // Usernames only, and only for signed-in users: never indexed.
  robots: { index: false, follow: false },
};

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <AppShellSkeleton label="Loading the leaderboard">
          <div className="max-w-3xl">
            <SkeletonBlock className="h-8 w-48" />
            <SkeletonBlock className="mt-4 h-11" />
            <SkeletonBlock className="mt-4 h-14" />
            <SkeletonBlock className="mt-4 h-80" />
          </div>
        </AppShellSkeleton>
      }
    >
      <LeaderboardScreen />
    </Suspense>
  );
}
