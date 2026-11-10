"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { checkUsername, signUp } from "@/app/actions/auth";
import { FormError } from "@/components/auth/AuthShell";
import { LIVE } from "@/components/providers/AccountProvider";
import { useFindListing } from "@/components/providers/ListingsProvider";

import { Button } from "@/components/ui/Button";
import { Checkbox, PasswordField, TextField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { SegmentBar } from "@/components/ui/SegmentBar";
import { findCityById } from "@/lib/catalog/cities";
import { AGE_ERROR, CONSENT_ERROR, type SignUpErrors } from "@/lib/auth/signup";
import { PASSWORD_MIN, suggestUsernames, validatePassword, validateUsername } from "@/lib/auth/validation";
import { isUsernameTaken } from "@/lib/sample/accounts";
import { StepHeading, focusFirstInvalid, type StepProps } from "./shared";

const STRENGTH_COPY = {
  "too-short": "Too short so far",
  okay: "Good. Longer is even stronger.",
  strong: "Strong password.",
} as const;

type Availability = { value: string; taken: boolean; suggestions: string[]; unknown?: boolean };

/** Preview only: the sample list of taken names, answered like the server would. */
function sampleAvailability(value: string): Availability {
  const taken = isUsernameTaken(value);
  return { value, taken, suggestions: taken ? suggestUsernames(value, isUsernameTaken) : [] };
}

export function StepAccount({ draft, update, onNext, focusOnMount, saveId }: StepProps & { saveId: string | null }) {
  const router = useRouter();
  const findListing = useFindListing();
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState(draft.username);
  const [password, setPassword] = useState(""); // never stored anywhere
  const [consent, setConsent] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false, consent: false, ageOk: false });
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<SignUpErrors & { forUsername?: string }>({});

  // Availability check while typing, debounced. Live: a rate-limited server check.
  const uCheck = validateUsername(username);
  const [availability, setAvailability] = useState<Availability | null>(null);
  useEffect(() => {
    if (!uCheck.ok) return;
    const value = uCheck.value;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!LIVE) {
        setAvailability(sampleAvailability(value));
        return;
      }
      try {
        const res = await checkUsername(value);
        if (cancelled) return;
        setAvailability(
          res.ok
            ? { value, taken: !res.available, suggestions: res.suggestions }
            : { value, taken: false, suggestions: [], unknown: true },
        );
      } catch {
        // Offline or a hiccup: don't block sign-up; the server checks again on submit.
        if (!cancelled) setAvailability({ value, taken: false, suggestions: [], unknown: true });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [uCheck.ok, uCheck.value]);

  const current = availability?.value === uCheck.value ? availability : null;
  const availState = !uCheck.ok ? null : !current ? "checking" : current.taken ? "taken" : current.unknown ? "unknown" : "free";
  const pCheck = validatePassword(password, uCheck.value);

  const serverUsernameError = serverErrors.forUsername === uCheck.value ? serverErrors.username : undefined;
  const usernameError =
    touched.username && !uCheck.ok
      ? uCheck.error
      : availState === "taken"
        ? "That one's taken."
        : serverUsernameError;
  // "Too short" waits until the field is left (no nagging mid-typing); specific problems
  // like a common password show right away because they're useful immediately.
  const passwordError =
    !pCheck.ok && (touched.password || pCheck.strength !== "too-short") ? pCheck.error : serverErrors.password;
  const consentError = touched.consent && !consent ? CONSENT_ERROR : undefined;
  const ageError = touched.ageOk && !ageOk ? AGE_ERROR : undefined;

  const suggestions = availState === "taken" ? (current?.suggestions ?? []) : [];

  const savedListing = saveId ? findListing(saveId) : null;
  const city = findCityById(draft.cityId);
  const carried = [
    draft.skills.length ? `${draft.skills.length} skill${draft.skills.length === 1 ? "" : "s"}` : null,
    city?.name ?? null,
    savedListing ? `"${savedListing.title}"` : null,
  ].filter(Boolean);

  const submit = async () => {
    setTouched({ username: true, password: true, consent: true, ageOk: true });
    setServerErrors({});
    if (!uCheck.ok || availState === "taken" || !pCheck.ok || !consent || !ageOk) {
      // Wait a frame so the error attributes are rendered before moving focus.
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    setSubmitting(true);

    if (LIVE) {
      let res: Awaited<ReturnType<typeof signUp>>;
      try {
        res = await signUp({ username: uCheck.value, password, consent, ageOk });
      } catch {
        res = { ok: false, errors: { form: "Couldn't reach InternQuest. Check your connection and try again." } };
      }
      if (!res.ok) {
        setServerErrors({ ...res.errors, forUsername: uCheck.value });
        setSubmitting(false);
        requestAnimationFrame(() =>
          res.ok || !res.errors.form ? focusFirstInvalid(formRef.current) : formErrorRef.current?.focus(),
        );
        return;
      }
      if (!res.signedIn) {
        // The account exists but the automatic login didn't go through: log in by hand, then continue.
        router.push(`/login?next=${encodeURIComponent("/start?step=2")}`);
        return;
      }
    }

    update({ username: uCheck.value, accountDone: true });
    onNext();
  };

  return (
    <>
      <StepHeading
        title="Create your character"
        description="A username and password are all you need. No email or real name."
        focusOnMount={focusOnMount}
      />

      {carried.length > 0 && (
        <p className="mb-5 flex items-start gap-2 bg-green-tint p-3 text-sm text-ink">
          <PixelIcon name="check" scale={2} className="mt-0.5 text-green" />
          <span>
            <span className="font-semibold">Coming with you:</span> {carried.join(", ")}
          </span>
        </p>
      )}

      {serverErrors.form && (
        <div ref={formErrorRef} tabIndex={-1} className="-mt-5 mb-5 focus:outline-none">
          <FormError message={serverErrors.form} />
        </div>
      )}

      <form
        ref={formRef}
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextField
          label="Username"
          hint="This is the name other people see, so skip your real name if you like."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, username: true }))}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          error={usernameError}
          status={
            availState === "checking" ? (
              <span className="text-muted">Checking…</span>
            ) : availState === "free" ? (
              <span className="flex items-center gap-1.5 font-semibold text-green">
                <PixelIcon name="check" scale={2} /> {uCheck.value} is free
              </span>
            ) : availState === "unknown" ? (
              <span className="text-muted">Couldn&apos;t check right now. We&apos;ll check when you continue.</span>
            ) : (
              <span className="text-muted">3 to 20 letters, numbers, dots, or underscores.</span>
            )
          }
        />
        {suggestions.length > 0 && (
          <div className="-mt-3">
            <p className="text-sm text-muted">Try one of these:</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setUsername(s)}
                  className="inline-flex min-h-tap items-center border-2 border-muted bg-screen px-3 text-base hover:border-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <PasswordField
          label="Password"
          hint="At least 10 characters. A short sentence works well, like “tita loves mango shakes”."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          autoComplete="new-password"
          maxLength={128}
          error={passwordError}
          status={
            password ? (
              <span className="flex items-center gap-2">
                <SegmentBar
                  value={pCheck.strength === "strong" ? 3 : pCheck.strength === "okay" ? 2 : 1}
                  max={3}
                  segments={3}
                  height="sm"
                  className="w-16"
                />
                <span className={pCheck.ok ? "font-semibold text-green" : "text-muted"}>
                  {pCheck.strength === "too-short" ? (
                    <>
                      {/* The countdown changes every keystroke, so screen readers get a steady label instead. */}
                      <span aria-hidden="true">{PASSWORD_MIN - password.length} more characters</span>
                      <span className="sr-only">{STRENGTH_COPY["too-short"]}</span>
                    </>
                  ) : (
                    STRENGTH_COPY[pCheck.strength]
                  )}
                </span>
              </span>
            ) : undefined
          }
        />

        <div>
          <Checkbox
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              setTouched((t) => ({ ...t, consent: true }));
            }}
            error={consentError}
            label={
              <>
                I agree to the{" "}
                <Link href="/privacy" className="font-semibold text-green underline underline-offset-4">
                  privacy notice
                </Link>
                .
              </>
            }
          />
          <p className="ml-9 text-sm text-muted">
            We keep your username, skills, city, and the applications you track. You can delete everything anytime.
          </p>
        </div>

        <Checkbox
          checked={ageOk}
          onChange={(e) => {
            setAgeOk(e.target.checked);
            setTouched((t) => ({ ...t, ageOk: true }));
          }}
          error={ageError}
          label="I'm 18 or older, or I have my parent's or guardian's permission."
        />

        <Button type="submit" size="lg" block loading={submitting}>
          Create character
        </Button>
      </form>

      <p className="mt-5 text-center text-base">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-green underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
