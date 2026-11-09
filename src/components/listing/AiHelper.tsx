"use client";

import { useState } from "react";
import { aiDraft, markCoverLetterUsed } from "@/app/actions/ai";
import { FormError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { AI_DAILY_LIMIT, AI_LABEL, AI_TEXT_MAX, type AiKind } from "@/lib/ai/prompts";

const NETWORK = "Couldn't reach InternQuest. Check your connection and try again.";

const COPY: Record<AiKind, { button: string; title: string; label: string; hint: string; placeholder: string; go: string }> = {
  cover_letter: {
    button: "Draft a cover letter",
    title: "Draft a cover letter",
    label: "A few lines about you (optional)",
    hint: "Your course, a project, or why this company. We send only this, your skills, and the listing's short description.",
    placeholder: "e.g. 3rd year BSIT. Built a sensor dashboard for our capstone.",
    go: "Write my draft",
  },
  resume_bullet: {
    button: "Rewrite a resume line",
    title: "Rewrite a resume line",
    label: "Your resume line",
    hint: "Paste one line from your resume. We send only this, your skills, and the listing's short description.",
    placeholder: "e.g. Helped make a website for our org",
    go: "Rewrite it",
  },
};

/**
 * Optional AI helper on a listing (SPEC §9). Drafts are made on the server,
 * labelled as AI drafts, editable here, and never saved by us.
 */
export function AiHelper({ listingId }: { listingId: string }) {
  const [kind, setKind] = useState<AiKind | null>(null);
  return (
    <section aria-labelledby="ai-h" className="border border-line bg-screen p-4">
      <h2 id="ai-h" className="text-lg font-semibold">
        Need a starting point?
      </h2>
      <p className="text-sm text-muted">An AI helper can draft text for you to edit. {AI_DAILY_LIMIT} drafts a day.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <Button variant="secondary" onClick={() => setKind("cover_letter")}>
          {COPY.cover_letter.button}
        </Button>
        <Button variant="secondary" onClick={() => setKind("resume_bullet")}>
          {COPY.resume_bullet.button}
        </Button>
      </div>
      <Sheet open={kind !== null} onClose={() => setKind(null)} title={kind ? COPY[kind].title : ""} description={AI_LABEL}>
        {kind && <AiForm key={kind} kind={kind} listingId={listingId} />}
      </Sheet>
    </section>
  );
}

function AiForm({ kind, listingId }: { kind: AiKind; listingId: string }) {
  const toast = useToast();
  const copy = COPY[kind];
  const [text, setText] = useState("");
  const [draft, setDraft] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await aiDraft(kind, listingId, text);
      if (r.ok) {
        setDraft(r.draft);
        setLeft(r.usesLeft);
      } else setError(r.error);
    } catch {
      setError(NETWORK);
    }
    setBusy(false);
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast({ message: "Copied. Edit it before you send it." });
    } catch {
      toast({ tone: "error", message: "Couldn't copy. Select the text and copy it yourself." });
    }
  };

  const markUsed = async () => {
    setUsed(true);
    try {
      const r = await markCoverLetterUsed(listingId);
      if (r.ok) toast({ message: "Good luck with it.", tone: "success", exp: r.reward && r.reward.amount > 0 ? r.reward.amount : undefined });
      else {
        setUsed(false);
        toast({ tone: "error", message: r.error });
      }
    } catch {
      setUsed(false);
      toast({ tone: "error", message: NETWORK });
    }
  };

  const inputId = `ai-in-${kind}`;
  const outId = `ai-out-${kind}`;

  return (
    <div className="space-y-4">
      {error && <FormError message={error} />}
      <div className="space-y-1">
        <label htmlFor={inputId} className="block text-sm font-semibold">
          {copy.label}
        </label>
        <p className="text-sm text-muted">{copy.hint}</p>
        <textarea
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={AI_TEXT_MAX[kind]}
          rows={kind === "cover_letter" ? 4 : 3}
          placeholder={copy.placeholder}
          className="block w-full border-2 border-muted bg-screen px-3 py-2 text-base placeholder:text-muted"
        />
      </div>
      <Button block loading={busy} onClick={() => void generate()} icon={<PixelIcon name="tips" scale={2} />}>
        {draft ? "Try again" : copy.go}
      </Button>

      {draft && (
        <div className="space-y-2">
          <p className="flex items-start gap-2 border-l-4 border-alert bg-alert-tint p-3 text-sm font-semibold">
            <PixelIcon name="alert" scale={2} className="mt-0.5 flex-none text-alert" />
            {AI_LABEL} Check every fact and fill in anything in [brackets].
          </p>
          <label htmlFor={outId} className="block text-sm font-semibold">
            Your draft (you can edit it here)
          </label>
          <textarea
            id={outId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={kind === "cover_letter" ? 12 : 5}
            className="block w-full border-2 border-muted bg-screen px-3 py-2 text-base"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void copyDraft()}>
              Copy
            </Button>
            {kind === "cover_letter" && (
              <Button variant="secondary" disabled={used} onClick={() => void markUsed()}>
                {used ? "Marked as used" : "I used this"}
              </Button>
            )}
          </div>
          {left !== null && (
            <p className="text-sm text-muted" aria-live="polite">
              {left} of {AI_DAILY_LIMIT} drafts left today. We don&apos;t keep this text.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
