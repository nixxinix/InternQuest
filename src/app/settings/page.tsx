import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountScope } from "@/components/providers/AccountScope";
import { AppShellSkeleton, SkeletonBlock } from "@/components/layout/AppShellSkeleton";
import { SettingsScreen } from "@/components/settings/SettingsScreen";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <AccountScope>
      <Suspense
        fallback={
          <AppShellSkeleton label="Loading settings">
            <SkeletonBlock className="h-8 w-40" />
            <div className="mt-6 max-w-2xl space-y-6 lg:ml-56">
              <SkeletonBlock className="h-56" />
              <SkeletonBlock className="h-40" />
              <SkeletonBlock className="h-32" />
            </div>
          </AppShellSkeleton>
        }
      >
        <SettingsScreen />
      </Suspense>
    </AccountScope>
  );
}
