import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountScope } from "@/components/providers/AccountScope";
import { AppShellSkeleton, SkeletonBlock } from "@/components/layout/AppShellSkeleton";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

export const metadata: Metadata = {
  title: "Profile",
  // Personal page: never indexed. There are no public profile pages in v1.
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <AccountScope>
      <Suspense
        fallback={
          <AppShellSkeleton label="Loading your profile">
            <SkeletonBlock className="h-8 w-56" />
            <SkeletonBlock className="mt-4 h-44 lg:max-w-[calc(100%-24rem)]" />
            <SkeletonBlock className="mt-6 h-64 lg:max-w-[calc(100%-24rem)]" />
          </AppShellSkeleton>
        }
      >
        <ProfileScreen />
      </Suspense>
    </AccountScope>
  );
}
