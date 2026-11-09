"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { recoverWithCode, type RecoverState } from "@/app/actions/auth";
import { LIVE } from "@/components/providers/AccountProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { validatePassword } from "@/lib/auth/validation";
import { FormError } from "./AuthShell";

const LINK = "font-semibold text-green underline decoration-2 underline-offset-4";

/** Reset a forgotten password with one of the recovery codes saved at sign-up. Each code works once. */
export function RecoverForm() {
  const [state, action, pending] = useActionState<RecoverState, FormData>(recoverWithCode, {});
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [pwTouched, setPwTouched] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state.done) doneRef.current?.focus();
    else if (state.error) errorRef.current?.focus();
  }, [state]);

  if (state.done) {
    const left = state.done.codesLeft;
    return (
      <>
        <h1 ref={doneRef} tabIndex={-1} className="flex items-center gap-2 text-2xl font-semibold focus:outline-none">
          <PixelIcon name="check" scale={3} className="text-green" />
          Password changed
        </h1>
        <p className="mt-2 text-base">
          You&apos;re logged in. Any other device that was signed in has been logged out.
        </p>
        <p className={left <= 2 ? "mt-4 border-l-4 border-alert bg-alert-tint p-3 text-base" : "mt-4 text-base text-muted"}>
          That code is used up. You have {left} recovery {left === 1 ? "code" : "codes"} left.
          {left <= 2 && " Make a fresh set in Settings › Password recovery."}
        </p>
        <ButtonLink href="/home" size="lg" block className="mt-6">
          Go to my home
        </ButtonLink>
      </>
    );
  }

  const pwCheck = validatePassword(password, username);
  const passwordError =
    state.field === "password" && state.error ? state.error : pwTouched && password && !pwCheck.ok ? pwCheck.error : undefined;

  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-base text-muted">Use one of the recovery codes you saved when you signed up.</p>

      {!LIVE && (
        <p className="mt-4 border-l-4 border-muted bg-canvas p-3 text-sm text-muted">
          Preview: accounts aren&apos;t connected yet, so this won&apos;t work here.
        </p>
      )}
      {state.error && state.field !== "password" && (
        <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
          <FormError message={state.error} />
        </div>
      )}

      <form action={action} className="mt-6 space-y-5">
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
        <TextField
          name="code"
          label="Recovery code"
          hint="8 letters and numbers, like K7QM-3XRP. The dash is optional."
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          className="font-mono tracking-wider uppercase"
        />
        <PasswordField
          name="password"
          label="New password"
          hint="At least 10 characters. A short sentence works well."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setPwTouched(true)}
          autoComplete="new-password"
          maxLength={128}
          error={passwordError}
        />
        <Button type="submit" size="lg" block loading={pending}>
          Reset password
        </Button>
      </form>

      <div className="mt-8 border-t border-line pt-6 text-base">
        <p className="font-semibold">No codes?</p>
        <p className="mt-1 text-muted">
          Without a recovery code we can&apos;t check that the account is yours, so it can&apos;t be reset. You can{" "}
          <Link href="/start" className={LINK}>
            make a new account
          </Link>
          .
        </p>
        <p className="mt-4 text-center">
          <Link href="/login" className={LINK}>
            Back to log in
          </Link>
        </p>
      </div>
    </>
  );
}
