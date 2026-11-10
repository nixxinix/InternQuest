import type { Metadata } from "next";
import { AccountScope } from "@/components/providers/AccountScope";
import { TipsIndex } from "@/components/tips/TipsIndex";
import { TipsShell } from "@/components/tips/TipsShell";
import { loadGuideMetas } from "@/lib/content/loadGuides";

export const metadata: Metadata = {
  title: "Tips",
  description: "Short, practical guides for internship and OJT applicants: resumes, applications, and interviews.",
};

export default async function TipsPage() {
  const guides = await loadGuideMetas();
  return (
    <AccountScope>
      <TipsShell>
        <TipsIndex guides={guides} />
      </TipsShell>
    </AccountScope>
  );
}
