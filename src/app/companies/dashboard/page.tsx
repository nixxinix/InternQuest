import type { Metadata } from "next";
import { Suspense } from "react";
import { CompanyDashboard } from "@/components/company/CompanyDashboard";

export const metadata: Metadata = {
  title: "Your listings",
  robots: { index: false, follow: false },
};

export default function CompanyDashboardPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="on-bezel h-14" />
          <main className="mx-auto max-w-4xl px-gutter pt-6">
            <p className="sr-only">Loading your listings</p>
            <div aria-hidden="true" className="space-y-4">
              <div className="h-8 w-48 animate-shimmer bg-line" />
              <div className="h-11 animate-shimmer bg-line" />
              <div className="h-28 animate-shimmer bg-line" />
              <div className="h-28 animate-shimmer bg-line" />
            </div>
          </main>
        </div>
      }
    >
      <CompanyDashboard />
    </Suspense>
  );
}
