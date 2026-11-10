import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminQueue } from "@/components/admin/AdminQueue";
import { loadQueue, requireAdmin } from "@/lib/admin/server";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** W14. Behind an admin membership check (src/lib/admin/server.ts): requireAdmin() redirects anyone else. */
export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="on-bezel h-14" />
          <main className="mx-auto max-w-7xl px-gutter pt-6">
            <p className="sr-only">Loading the review queue</p>
            <div aria-hidden="true" className="space-y-4">
              <div className="h-11 w-96 max-w-full animate-shimmer bg-line" />
              <div className="h-64 animate-shimmer bg-line" />
            </div>
          </main>
        </div>
      }
    >
      <QueueLoader />
    </Suspense>
  );
}

async function QueueLoader() {
  const admin = await requireAdmin();
  const { items, audit } = await loadQueue();
  return <AdminQueue initialItems={items} initialAudit={audit} adminLabel={admin.label} />;
}
