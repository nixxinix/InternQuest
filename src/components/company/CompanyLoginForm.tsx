"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { companyLogIn, type CompanyLogInState } from "@/app/actions/company";
import { FormError } from "@/components/auth/AuthShell";
import { LIVE } from "@/components/providers/AccountProvider";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";

const LINK = "font-semibold text-green underline decoration-2 underline-offset-4";

/** Companies log in with their work email, not a username (works without JavaScript too). */
export function CompanyLoginForm() {
  const [state, action, pending] = useActionState<CompanyLogInState, FormData>(companyLogIn, {});
  const [email, setEmail] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-1 text-base text-muted">Use your company&apos;s work email.</p>

      {!LIVE && (
        <p className="mt-4 border-l-4 border-muted bg-canvas p-3 text-sm text-muted">
          Preview: accounts aren&apos;t connected yet, so logging in won&apos;t work here.
        </p>
      )}
      {state.error && (
        <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
          <FormError message={state.error} />
        </div>
      )}

      <form action={action} className="mt-6 space-y-5">
        <TextField
          name="email"
          label="Work email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
        />
        <PasswordField name="password" label="Password" autoComplete="current-password" maxLength={128} />
        <Button type="submit" size="lg" block loading={pending}>
          Log in
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-center text-base">
        New here?{" "}
        <Link href="/companies/register" className={LINK}>
          Register your company
        </Link>
      </p>
      <p className="mt-2 text-center text-base">
        Looking for yourself, not a company?{" "}
        <Link href="/login" className={LINK}>
          Intern log in
        </Link>
      </p>
    </>
  );
}
