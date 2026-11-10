"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { logIn, type LogInState } from "@/app/actions/auth";
import { LIVE } from "@/components/providers/AccountProvider";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { safeNext } from "@/lib/auth/routes";
import { FormError } from "./AuthShell";

const LINK = "font-semibold text-green underline decoration-2 underline-offset-4";

/**
 * Log in with username and password. Works without JavaScript too (a plain
 * form post to the server action). Errors are one generic message, so the
 * form never reveals whether a username exists.
 */
export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const asCompany = params.get("as") === "company";
  const [state, action, pending] = useActionState<LogInState, FormData>(logIn, {});
  // Controlled, so a failed try keeps the username (the password field clears, as usual).
  const [username, setUsername] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-1 text-base text-muted">Use your InternQuest username, not an email.</p>

      {asCompany && (
        <p className="mt-4 border-l-4 border-ink bg-screen p-3 text-sm">
          Company accounts open later. This login is for interns.{" "}
          <Link href="/companies" className={LINK}>
            Back to the company page
          </Link>
        </p>
      )}
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
        <input type="hidden" name="next" value={next} />
        <TextField
          name="username"
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
        />
        <PasswordField name="password" label="Password" autoComplete="current-password" maxLength={128} />
        <Button type="submit" size="lg" block loading={pending}>
          Log in
        </Button>
      </form>

      <p className="mt-5 text-center text-base">
        <Link href="/login/recover" className={LINK}>
          Forgot your password?
        </Link>
      </p>
      <p className="mt-8 border-t border-line pt-6 text-center text-base">
        New here?{" "}
        <Link href="/start" className={LINK}>
          Create your character
        </Link>
      </p>
    </>
  );
}
