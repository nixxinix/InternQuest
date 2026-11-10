"use client";

import { useId, useRef, useState } from "react";
import { saveProfile } from "@/app/actions/profile";
import { FormError } from "@/components/auth/AuthShell";
import { ProfileFields } from "@/components/profile/ProfileFields";
import { LIVE } from "@/components/providers/AccountProvider";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { Button } from "@/components/ui/Button";
import { cityLabel, findCityById } from "@/lib/catalog/cities";
import { profileErrors } from "@/lib/profile/validate";
import { StepHeading, focusFirstInvalid, type StepProps } from "./shared";

/** Step 4: the character sheet (Full) or profile (Light, Plain). Same fields as Profile > Edit. */
export function StepCharacter({ draft, update, onNext, focusOnMount }: StepProps) {
  const f = useFeatures();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [tried, setTried] = useState(false);
  const [cityText, setCityText] = useState(cityLabel(findCityById(draft.cityId)));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const submit = async () => {
    setTried(true);
    setSaveError(null);
    const errors = profileErrors(draft, cityText, { anyPlace: LIVE });
    if (errors.field || errors.city) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    if (errors.skills) {
      // No skill picked: put the cursor in the skill search, right above the message.
      requestAnimationFrame(() => document.getElementById(`${uid}-q`)?.focus());
      return;
    }
    if (LIVE) {
      setBusy(true);
      let message: string | null = null;
      try {
        // An empty city box means "no city", even if one was picked earlier.
        const res = await saveProfile(
          {
            look: draft.look,
            field: draft.field,
            skills: draft.skills,
            cityId: cityText.trim() ? draft.cityId : null,
            cityText,
            workType: draft.workType,
            status: draft.status,
            school: draft.school,
          },
          true,
        );
        if (res.ok) update({ cityId: res.cityId });
        else message = res.error;
      } catch {
        message = "Couldn't save. Check your connection and try again.";
      }
      setBusy(false);
      if (message) {
        setSaveError(message);
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
    }
    onNext();
  };

  return (
    <>
      <StepHeading
        title={f.avatar ? "Your character" : "Your profile"}
        description="This is what we use to find your matches. You can change any of it later."
        focusOnMount={focusOnMount}
      />

      {saveError && (
        <div ref={errorRef} tabIndex={-1} className="-mt-5 mb-5 focus:outline-none">
          <FormError message={saveError} />
        </div>
      )}

      <form
        ref={formRef}
        noValidate
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
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
        <Button type="submit" size="lg" block loading={busy}>
          {f.avatar ? "Start my first quest" : "Finish setup"}
        </Button>
      </form>
    </>
  );
}
