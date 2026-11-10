import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CompanySettings } from "@/components/company/CompanySettings";
import { getCompany } from "@/lib/company/server";

export const metadata: Metadata = { title: "Company details", robots: { index: false, follow: false } };

export default function CompanySettingsPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="on-bezel h-14" />
          <main className="mx-auto max-w-lg px-gutter pt-6">
            <p className="sr-only">Loading</p>
            <div aria-hidden="true" className="space-y-4">
              <div className="h-8 w-48 animate-shimmer bg-line" />
              <div className="h-44 animate-shimmer bg-line" />
            </div>
          </main>
        </div>
      }
    >
      <SettingsLoader />
    </Suspense>
  );
}

async function SettingsLoader() {
  const company = await getCompany();
  if (!company) redirect("/companies/login");
  return <CompanySettings company={company} />;
}
