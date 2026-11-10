"use client";

import { useId, useState } from "react";
import { reportListing } from "@/app/actions/report";
import { LIVE } from "@/components/providers/AccountProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import type { PendingApply } from "./usePendingApply";

/* ------------------------------------------------------------------------ */
/* Did you apply? (on return)                                               */
/* ------------------------------------------------------------------------ */

type ApplyReturnSheetProps = {
  pending: PendingApply | null;
  onClose: () => void;
  /** Guests are offered a character; members confirm (EXP is given by the server). */
  viewer: "guest" | "member";
  startHref: string;
  onConfirm?: (id: string) => void;
};

export function ApplyReturnSheet({ pending, onClose, viewer, startHref, onConfirm }: ApplyReturnSheetProps) {
  const [step, setStep] = useState<"ask" | "guest-yes">("ask");
  const close = () => {
    setStep("ask");
    onClose();
  };

  return (
    <Sheet
      open={pending !== null}
      onClose={close}
      title={
        step === "ask" ? `Did you send your application to ${pending?.company ?? "them"}?` : "Nice work. That's a real step."
      }
      description={
        step === "ask"
          ? viewer === "member"
            ? "We'll move it to Applied so you can keep track."
            : `For "${pending?.title ?? ""}".`
          : "Create a character and we'll add it to your applications, so you know when to follow up."
      }
    >
      {step === "ask" ? (
        <div className="grid gap-2">
          <Button
            block
            onClick={() => {
              if (viewer === "member" && pending) {
                onConfirm?.(pending.id);
                close();
              } else {
                setStep("guest-yes");
              }
            }}
          >
            Yes, I applied
          </Button>
          <Button variant="secondary" block onClick={close}>
            Not yet
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <ButtonLink href={`${startHref}${startHref.includes("?") ? "&" : "?"}applied=${pending?.id ?? ""}`} block>
            Create my character
          </ButtonLink>
          <Button variant="secondary" block onClick={close}>
            Maybe later
          </Button>
          <p className="mt-1 text-sm text-muted">No email or real name needed.</p>
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------------ */
/* Apply by email (W6b)                                                      */
/* ------------------------------------------------------------------------ */

type EmailApplySheetProps = {
  open: boolean;
  onClose: () => void;
  email: string;
  subject: string;
  /** Called when the visitor opens their email app (counts as an Apply click). */
  onOpenEmail: () => void;
};

export function EmailApplySheet({ open, onClose, email, subject, onOpenEmail }: EmailApplySheetProps) {
  const [copied, setCopied] = useState<"email" | "subject" | null>(null);

  const copy = async (what: "email" | "subject", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied(null); // Clipboard blocked: the text is still visible and selectable.
    }
  };

  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

  return (
    <Sheet
      open={open}
      onClose={() => {
        setCopied(null);
        onClose();
      }}
      title="Apply by email"
      description="This company takes applications by email. Send yours from your own email app."
    >
      <dl className="space-y-3">
        <CopyRow label="Send to" value={email} copied={copied === "email"} onCopy={() => copy("email", email)} />
        <CopyRow label="Subject" value={subject} copied={copied === "subject"} onCopy={() => copy("subject", subject)} />
      </dl>
      <p className="mt-3 text-sm text-muted">Tip: attach your resume as a PDF and keep the message short.</p>
      <p aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </p>
      <a
        href={mailto}
        onClick={onOpenEmail}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-green px-6 text-lg font-semibold text-screen shadow-bevel hover:bg-green-press"
      >
        Open email app
      </a>
    </Sheet>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-end justify-between gap-2 border-b border-line pb-2">
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="break-words text-base font-semibold">{value}</dd>
      </div>
      <Button variant="secondary" className="flex-none" onClick={onCopy} aria-label={`Copy ${label.toLowerCase()}`}>
        {copied ? (
          <>
            <PixelIcon name="check" scale={2} /> Copied
          </>
        ) : (
          "Copy"
        )}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Report listing (W6c)                                                      */
/* ------------------------------------------------------------------------ */

const REPORT_REASONS = [
  { id: "payment", label: "Asks for payment or fees" },
  { id: "scam", label: "Looks fake or like a scam" },
  { id: "closed", label: "Closed or expired" },
  { id: "wrong", label: "Wrong details" },
  { id: "other", label: "Something else" },
] as const;

type ReportSheetProps = { open: boolean; onClose: () => void; listingId: string; listingTitle: string };

/**
 * Sends to the reports table (rate-limited server action), which feeds the
 * admin queue. Works signed in or as a guest; reporters are never shown to
 * the company or to admin.
 */
export function ReportSheet({ open, onClose, listingId, listingTitle }: ReportSheetProps) {
  const uid = useId();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason(null);
    setNote("");
    setSent(false);
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!reason) {
      setError("Pick the reason that fits best.");
      return;
    }
    if (reason === "other" && !note.trim()) {
      setError("Tell us a little about what's wrong.");
      return;
    }
    if (!LIVE) {
      setSent(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await reportListing(listingId, reason, note).catch(() => ({ ok: false as const, error: "Couldn't reach InternQuest. Check your connection and try again." }));
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSent(true);
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={sent ? "Thanks for telling us" : "What's wrong with this listing?"}
      description={sent ? undefined : `Reporting "${listingTitle}".`}
    >
      {sent ? (
        <div>
          <p className="text-base">
            We review every report. If the listing breaks our rules, we hide it. The company is never told who reported it.
          </p>
          <Button block className="mt-4" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset aria-describedby={error ? `${uid}-err` : undefined}>
            <legend className="sr-only">Reason</legend>
            <div className="grid gap-1">
              {REPORT_REASONS.map((r) => (
                <label key={r.id} className="flex min-h-tap cursor-pointer items-center gap-3 border-b border-line py-1">
                  <input
                    type="radio"
                    name={`${uid}-reason`}
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => {
                      setReason(r.id);
                      setError(null);
                    }}
                    className="size-5 accent-green"
                  />
                  <span className="text-base">{r.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {reason === "other" && (
            <div className="mt-3">
              <label htmlFor={`${uid}-note`} className="block text-sm font-semibold">
                What&apos;s wrong?
              </label>
              <textarea
                id={`${uid}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                className="mt-1 block w-full border-2 border-muted bg-screen p-3 text-base"
              />
            </div>
          )}
          {error && (
            <p id={`${uid}-err`} role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-alert">
              <PixelIcon name="alert" scale={2} className="mt-0.5" />
              {error}
            </p>
          )}
          <Button type="submit" block className="mt-4" loading={busy}>
            Send report
          </Button>
        </form>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------------ */
/* Save (logged out)                                                         */
/* ------------------------------------------------------------------------ */

type GuestSaveSheetProps = {
  listingTitle: string | null;
  listingId: string | null;
  startHref: string;
  onClose: () => void;
};

/** Saving needs an account, so this is where a visitor is asked to create one (USER_FLOWS §1.6). */
export function GuestSaveSheet({ listingTitle, listingId, startHref, onClose }: GuestSaveSheetProps) {
  return (
    <Sheet
      open={listingId !== null}
      onClose={onClose}
      title="Keep this listing?"
      description={
        listingTitle
          ? `Create a character to save "${listingTitle}" and track your application. Your field, skills, and city come with you.`
          : undefined
      }
    >
      <div className="grid gap-2">
        <ButtonLink href={`${startHref}${startHref.includes("?") ? "&" : "?"}save=${listingId ?? ""}`} block>
          Create my character
        </ButtonLink>
        <Button variant="secondary" block onClick={onClose}>
          Not now
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted">No email or real name needed.</p>
    </Sheet>
  );
}
