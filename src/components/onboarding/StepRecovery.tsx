"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { cn } from "@/lib/cn";
import { generateRecoveryCodes, recoveryFileText } from "@/lib/auth/recovery";
import { downloadText } from "@/lib/browser/download";
import { isEmail } from "@/lib/auth/validation";
import { StepHeading, focusFirstInvalid, type StepProps } from "./shared";

/**
 * Step 2: a way back in (decision M3). Codes are the default because they
 * need no email at all. Phase 1: the server generates the codes and stores
 * only their hashes; they are shown once, here.
 */
export function StepRecovery({ draft, update, onNext, focusOnMount }: StepProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"codes" | "email">(draft.recovery === "email" ? "email" : "codes");
  const [codes] = useState(() => generateRecoveryCodes());
  const [savedCodes, setSavedCodes] = useState(false);
  const [email, setEmail] = useState(draft.recoveryEmail);
  const [tried, setTried] = useState(false);
  const [copied, setCopied] = useState(false);

  const emailError = tried && kind === "email" && !isEmail(email) ? "That doesn't look like an email address yet." : undefined;
  const codesError =
    tried && kind === "codes" && !savedCodes ? "Download or copy the codes first, then tick this box." : undefined;

  const download = () =>
    downloadText(recoveryFileText(draft.username, codes, new Date()), `internquest-recovery-${draft.username}.txt`);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false); // Clipboard blocked: the codes are still on screen to write down.
    }
  };

  const submit = () => {
    setTried(true);
    if ((kind === "email" && !isEmail(email)) || (kind === "codes" && !savedCodes)) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    update({ recovery: kind, recoveryEmail: kind === "email" ? email.trim() : "" });
    onNext();
  };

  return (
    <>
      <StepHeading
        title="A way back in, just in case"
        description="If you ever forget your password, this is how you get your account back."
        focusOnMount={focusOnMount}
      />

      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset>
          <legend className="sr-only">Recovery method</legend>
          <div className="grid gap-3">
            {(
              [
                { id: "codes", title: "Save recovery codes", body: "8 one-time codes. No email needed." },
                { id: "email", title: "Add a recovery email", body: "Only used to reset your password. Never for ads." },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 border-2 bg-screen p-4",
                  kind === opt.id ? "border-green" : "border-line hover:border-muted",
                  "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                )}
              >
                <input
                  type="radio"
                  name="recovery"
                  value={opt.id}
                  checked={kind === opt.id}
                  onChange={() => setKind(opt.id)}
                  className="mt-1 size-5 flex-none accent-green"
                />
                <span>
                  <span className="block font-semibold">{opt.title}</span>
                  <span className="block text-sm text-muted">{opt.body}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          {kind === "codes" ? (
            <div className="border border-line bg-screen p-4">
              <p className="text-sm text-muted">Each code works once. Keep them somewhere private.</p>
              <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-base" aria-label="Your recovery codes">
                {codes.map((c) => (
                  <li key={c} className="tracking-wider">
                    {c}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={download} icon={<PixelIcon name="download" scale={2} />}>
                  Download
                </Button>
                <Button variant="secondary" onClick={copy}>
                  {copied ? "Copied" : "Copy all"}
                </Button>
              </div>
              <p aria-live="polite" className="sr-only">
                {copied ? "Codes copied" : ""}
              </p>
              <div className="mt-3">
                <Checkbox
                  checked={savedCodes}
                  onChange={(e) => setSavedCodes(e.target.checked)}
                  label="I saved these codes somewhere safe"
                  error={codesError}
                />
              </div>
            </div>
          ) : (
            <TextField
              label="Recovery email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              hint="We'll only write to it if you ask to reset your password."
            />
          )}
        </div>

        <Button type="submit" size="lg" block className="mt-6">
          Continue
        </Button>
      </form>

      <div className="mt-3 text-center">
        <Button
          variant="ghost"
          onClick={() => {
            update({ recovery: "skipped", recoveryEmail: "" });
            onNext();
          }}
        >
          Skip for now
        </Button>
        <p className="text-sm text-muted">Without either one, a forgotten password can&apos;t be reset. You can add one later in Settings.</p>
      </div>
    </>
  );
}
