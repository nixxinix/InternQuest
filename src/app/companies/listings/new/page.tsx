import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PostForm } from "@/components/company/PostForm";
import { rowToDraft } from "@/lib/company/account";
import { getCompany, getCompanyPosting } from "@/lib/company/server";
import { EMPTY_DRAFT } from "@/lib/company/posting";

export const metadata: Metadata = {
  title: "New listing",
  robots: { index: false, follow: false },
};

export default function NewListingPage({ searchParams }: PageProps<"/companies/listings/new">) {
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
      <FormLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function FormLoader({ searchParams }: { searchParams: PageProps<"/companies/listings/new">["searchParams"] }) {
  const company = await getCompany();
  if (!company) redirect("/companies/login");

  const params = await searchParams;
  const id = typeof params.id === "string" ? params.id : null;
  if (!id) return <PostForm company={company} editingId={null} editingStatus={null} initialDraft={EMPTY_DRAFT} />;

  const row = await getCompanyPosting(company.id, id);
  if (!row) redirect("/companies/dashboard");
  const status = row.status === "draft" || row.status === "published" || row.status === "closed" ? row.status : null;
  return <PostForm company={company} editingId={id} editingStatus={status} initialDraft={rowToDraft(row)} />;
}
