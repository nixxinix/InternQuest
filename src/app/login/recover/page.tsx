import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RecoverForm } from "@/components/auth/RecoverForm";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Reset a forgotten InternQuest password with a recovery code.",
  robots: { index: false, follow: false },
};

export default function RecoverPage() {
  return (
    <AuthShell>
      <RecoverForm />
    </AuthShell>
  );
}
