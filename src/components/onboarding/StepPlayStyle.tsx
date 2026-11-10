"use client";

import { useRef, useState } from "react";
import { saveSettings } from "@/app/actions/profile";
import { FormError } from "@/components/auth/AuthShell";
import { Avatar } from "@/components/game/Avatar";
import { LIVE } from "@/components/providers/AccountProvider";
import { useGameMode } from "@/components/providers/GameModeProvider";
import { Button } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { SegmentBar } from "@/components/ui/SegmentBar";
import { cn } from "@/lib/cn";
import { GAME_MODES, MODE_LABELS, type GameMode } from "@/lib/game/mode";
import { StepHeading, type StepProps } from "./shared";

/** Step 3. Comes before the character step so Plain users never pick an avatar they won't see. */
export function StepPlayStyle({ draft, update, onNext, focusOnMount }: StepProps) {
  const { setMode } = useGameMode();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const choose = (m: GameMode) => {
    setMode(m); // live: the next step already adapts
    update({ mode: m });
  };

  const next = async () => {
    setError(null);
    if (LIVE) {
      setBusy(true);
      let message: string | null = null;
      try {
        const res = await saveSettings({ mode: draft.mode });
        if (!res.ok) message = res.error;
      } catch {
        message = "Couldn't save. Check your connection and try again.";
      }
      setBusy(false);
      if (message) {
        setError(message);
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
    }
    update({ styleDone: true });
    onNext();
  };

  return (
    <>
      <StepHeading
        title="How much game do you want?"
        description="Job hunting is work. Pick the amount of fun that helps you, not the amount that distracts you."
        focusOnMount={focusOnMount}
      />

      <fieldset>
        <legend className="sr-only">Play style</legend>
        <div className="grid gap-3">
          {GAME_MODES.map((m) => {
            const on = draft.mode === m;
            return (
              <label
                key={m}
                className={cn(
                  "flex cursor-pointer flex-col gap-3 border-2 bg-screen p-4",
                  on ? "border-green" : "border-line hover:border-muted",
                  "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                )}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={on}
                    onChange={() => choose(m)}
                    className="mt-1 size-5 flex-none accent-green"
                  />
                  <span className="flex-1">
                    <span className="block font-semibold">
                      {MODE_LABELS[m].name}
                      {m === "full" && <span className="ml-2 text-sm font-normal text-muted">(the default)</span>}
                    </span>
                    <span className="block text-sm text-muted">{MODE_LABELS[m].summary}</span>
                  </span>
                </span>
                <ModePreview mode={m} look={draft.look} />
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-4 text-sm text-muted">You can change this anytime in Settings.</p>

      {error && (
        <div ref={errorRef} tabIndex={-1} className="focus:outline-none">
          <FormError message={error} />
        </div>
      )}

      <Button size="lg" block className="mt-5" loading={busy} onClick={() => void next()}>
        Continue with {MODE_LABELS[draft.mode].name}
      </Button>
    </>
  );
}

/** Tiny static picture of the header in each mode. Decorative: the text above says the same thing. */
function ModePreview({ mode, look }: { mode: GameMode; look: { skin: string; hair: string } }) {
  return (
    <span aria-hidden="true" className="on-bezel flex h-12 items-center gap-2 px-3">
      {mode === "full" && <Avatar look={look} scale={3} />}
      {mode === "plain" ? (
        <span className="font-pixel text-hud-sm uppercase">InternQuest</span>
      ) : (
        <>
          <span className="font-pixel text-hud-sm uppercase text-bezel-text">
            Lv <span className="text-lime">1</span>
          </span>
          <SegmentBar value={3} max={10} segments={10} surface="bezel" height="sm" className="w-24" />
        </>
      )}
      {mode === "full" && (
        <span className="ml-auto flex items-center gap-1 text-lime">
          <PixelIcon name="flame" scale={2} />
          <span className="font-pixel text-hud-sm uppercase">1 wk</span>
        </span>
      )}
    </span>
  );
}
