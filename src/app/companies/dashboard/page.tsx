import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CompanyDashboard } from "@/components/company/CompanyDashboard";
import { getCompany, getCompanyListings } from "@/lib/company/server";

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
      <DashboardLoader />
    </Suspense>
  );
}

/** Loads the signed-in company and its listings on the server; the real security check. */
async function DashboardLoader() {
  const company = await getCompany();
  if (!company) redirect("/companies/login");
  const postings = await getCompanyListings(company.id);
  return <CompanyDashboard company={company} initialPostings={postings} />;
}
