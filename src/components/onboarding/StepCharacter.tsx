"use client";

import { useId, useRef, useState } from "react";
import { ProfileFields } from "@/components/profile/ProfileFields";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { Button } from "@/components/ui/Button";
import { findCityById } from "@/lib/catalog/cities";
import { profileErrors } from "@/lib/profile/validate";
import { StepHeading, focusFirstInvalid, type StepProps } from "./shared";

/** Step 4: the character sheet (Full) or profile (Light, Plain). Same fields as Profile > Edit. */
export function StepCharacter({ draft, update, onNext, focusOnMount }: StepProps) {
  const f = useFeatures();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [tried, setTried] = useState(false);
  const [cityText, setCityText] = useState(findCityById(draft.cityId)?.name ?? "");

  const submit = () => {
    setTried(true);
    const errors = profileErrors(draft, cityText);
    if (errors.field || errors.city) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    if (errors.skills) {
      // No skill picked: put the cursor in the skill search, right above the message.
      requestAnimationFrame(() => document.getElementById(`${uid}-q`)?.focus());
      return;
    }
    // Phase 1: server action saves the profile and awards "complete profile" (+50, once).
    onNext();
  };

  return (
    <>
      <StepHeading
        title={f.avatar ? "Your character" : "Your profile"}
        description="This is what we use to find your matches. You can change any of it later."
        focusOnMount={focusOnMount}
      />

      <form
        ref={formRef}
        noValidate
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <ProfileFields
          values={draft}
          onChange={update}
          cityText={cityText}
          onCityText={setCityText}
          showErrors={tried}
          idPrefix={uid}
        />
        <Button type="submit" size="lg" block>
          {f.avatar ? "Start my first quest" : "Finish setup"}
        </Button>
      </form>
    </>
  );
}
