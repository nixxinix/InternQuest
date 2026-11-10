import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell, AuthSkeleton } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to InternQuest with your username and password.",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<AuthSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
