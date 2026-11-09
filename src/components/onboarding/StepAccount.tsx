"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, PasswordField, TextField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { SegmentBar } from "@/components/ui/SegmentBar";
import { findCityById } from "@/lib/catalog/cities";
import { PASSWORD_MIN, suggestUsernames, validatePassword, validateUsername } from "@/lib/auth/validation";
import { isUsernameTaken } from "@/lib/sample/accounts";
import { findSampleListing } from "@/lib/sample/listings";
import { StepHeading, focusFirstInvalid, type StepProps } from "./shared";

const STRENGTH_COPY = {
  "too-short": "Too short so far",
  okay: "Good. Longer is even stronger.",
  strong: "Strong password.",
} as const;

export function StepAccount({ draft, update, onNext, focusOnMount, saveId }: StepProps & { saveId: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [username, setUsername] = useState(draft.username);
  const [password, setPassword] = useState(""); // never stored anywhere
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false, consent: false });
  const [submitting, setSubmitting] = useState(false);

  // Availability check, debounced. Phase 1: a rate-limited server request.
  const uCheck = validateUsername(username);
  const [availability, setAvailability] = useState<{ value: string; taken: boolean } | null>(null);
  useEffect(() => {
    if (!uCheck.ok) return;
    const value = uCheck.value;
    const t = setTimeout(() => setAvailability({ value, taken: isUsernameTaken(value) }), 350);
    return () => clearTimeout(t);
  }, [uCheck.ok, uCheck.value]);

  const availState = !uCheck.ok ? null : availability?.value === uCheck.value ? (availability.taken ? "taken" : "free") : "checking";
  const pCheck = validatePassword(password, uCheck.value);

  const usernameError =
    touched.username && !uCheck.ok ? uCheck.error : availState === "taken" ? "That one's taken." : undefined;
  // "Too short" waits until the field is left (no nagging mid-typing); specific problems
  // like a common password show right away because they're useful immediately.
  const passwordError =
    !pCheck.ok && (touched.password || pCheck.strength !== "too-short") ? pCheck.error : undefined;
  const consentError =
    touched.consent && !consent ? "Tick this box to continue. It's how you give us the OK to store your data." : undefined;

  const suggestions = availState === "taken" ? suggestUsernames(uCheck.value, isUsernameTaken) : [];

  const savedListing = saveId ? findSampleListing(saveId) : null;
  const city = findCityById(draft.cityId);
  const carried = [
    draft.skills.length ? `${draft.skills.length} skill${draft.skills.length === 1 ? "" : "s"}` : null,
    city?.name ?? null,
    savedListing ? `"${savedListing.title}"` : null,
  ].filter(Boolean);

  const submit = () => {
    setTouched({ username: true, password: true, consent: true });
    if (!uCheck.ok || availState !== "free" || !pCheck.ok || !consent) {
      // Wait a frame so the error attributes are rendered before moving focus.
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    setSubmitting(true);
    // Phase 1: server action creates the account (Supabase Auth), then continues.
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

      <form
        ref={formRef}
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
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
