"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { OnboardingDraft } from "./draft";

export type StepProps = {
  draft: OnboardingDraft;
  update: (p: Partial<OnboardingDraft>) => void;
  onNext: () => void;
  /** True after the visitor moved between steps; the heading then takes focus. */
  focusOnMount: boolean;
};

/** Title block every step uses. Moves focus to the heading after a step change, for screen readers. */
export function StepHeading({
  title,
  description,
  focusOnMount,
}: {
  title: string;
  description?: ReactNode;
  focusOnMount: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <div className="mb-6">
      <h1 ref={ref} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
        {title}
      </h1>
      {description && <div className="mt-1 text-base text-muted">{description}</div>}
    </div>
  );
}

/** Moves focus to the first invalid control after a failed submit. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  const el = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
  el?.focus();
}
