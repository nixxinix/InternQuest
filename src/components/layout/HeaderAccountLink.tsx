"use client";

import Link from "next/link";
import { useAccountIfAvailable } from "@/components/providers/AccountProvider";

const CLASS = "inline-flex min-h-tap items-center border-2 border-bezel-text px-4 font-semibold text-screen hover:border-lime";

/** "Log in" for visitors; "My home" once signed in (on pages that load the account). */
export function HeaderAccountLink() {
  const account = useAccountIfAvailable();
  return account ? (
    <Link href="/home" className={CLASS}>
      My home
    </Link>
  ) : (
    <LoginLink />
  );
}

export function LoginLink() {
  return (
    <Link href="/login" className={CLASS}>
      Log in
    </Link>
  );
}
