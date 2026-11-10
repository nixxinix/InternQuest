import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountScope } from "@/components/providers/AccountScope";
import { ListingsScope } from "@/components/providers/ListingsScope";
import { HomeScreen } from "@/components/home/HomeScreen";
import { AppShellSkeleton, SkeletonBlock } from "@/components/layout/AppShellSkeleton";

export const metadata: Metadata = {
  title: "Home",
  // Personal page: never indexed.
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return (
    <AccountScope>
      <ListingsScope>
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
      </ListingsScope>
    </AccountScope>
  );
}
