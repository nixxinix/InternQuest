import type { Metadata } from "next";
import { Suspense } from "react";
import { CsvImport } from "@/components/admin/CsvImport";
import { requireAdmin } from "@/lib/admin/server";

export const metadata: Metadata = {
  title: "Import listings",
  robots: { index: false, follow: false },
};

/** Admin CSV import (SPEC §5.3). requireAdmin() sends anyone else to log in. */
export default function AdminImportPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="on-bezel h-14" />
          <main className="mx-auto max-w-3xl px-gutter pt-6">
            <p className="sr-only">Loading</p>
            <div aria-hidden="true" className="h-64 animate-shimmer bg-line" />
          </main>
        </div>
      }
    >
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  await requireAdmin("/admin/import");
  return <CsvImport />;
}
