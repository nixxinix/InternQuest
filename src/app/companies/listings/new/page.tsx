import type { Metadata } from "next";
import { Suspense } from "react";
import { PostForm } from "@/components/company/PostForm";

export const metadata: Metadata = {
  title: "New listing",
  robots: { index: false, follow: false },
};

export default function NewListingPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="on-bezel h-14" />
          <main className="mx-auto max-w-6xl px-gutter pt-6">
            <p className="sr-only">Loading the listing form</p>
            <div aria-hidden="true" className="space-y-4 lg:max-w-[calc(100%-24rem)]">
              <div className="h-8 w-48 animate-shimmer bg-line" />
              <div className="h-64 animate-shimmer bg-line" />
              <div className="h-40 animate-shimmer bg-line" />
            </div>
          </main>
        </div>
      }
    >
      <PostForm />
    </Suspense>
  );
}
