"use client";

import { useState } from "react";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { COMPANY_MAX, TITLE_MAX, URL_MAX, validateExternal, type ExternalDraft, type ExternalErrors } from "@/lib/tracker/log";
import { STATUS_LABEL } from "@/lib/tracker/status";

const EMPTY: ExternalDraft = { title: "", company: "", url: "", status: "applied", appliedOn: "" };

type AddExternalSheetProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (draft: ExternalDraft) => void;
  today: string;
};

/** "+ Add one I applied to elsewhere" (W7). Tracking only: no EXP (decision #18). */
export function AddExternalSheet({ open, onClose, onAdd, today }: AddExternalSheetProps) {
  const f = useFeatures();
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState<ExternalErrors>({});
  const [tried, setTried] = useState(false);

  const set = (patch: Partial<ExternalDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (tried) setErrors(validateExternal(next, today)); // re-check only after the first submit
  };

  const close = () => {
    setDraft(EMPTY);
    setErrors({});
    setTried(false);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Add one from elsewhere"
      description="Applied through a school board, a walk-in, or another site? Track it here too."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          const found = validateExternal(draft, today);
          setErrors(found);
          if (Object.keys(found).length > 0) {
            const first = (["title", "company", "appliedOn", "url"] as const).find((k) => found[k]);
            e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
            return;
          }
          onAdd(draft);
          close();
        }}
        className="space-y-4"
      >
        <TextField
          label="Role"
          name="title"
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          maxLength={TITLE_MAX}
          placeholder="e.g. Admin OJT"
          error={errors.title}
          autoComplete="off"
        />
        <TextField
          label="Company or office"
          name="company"
          value={draft.company}
          onChange={(e) => set({ company: e.target.value })}
          maxLength={COMPANY_MAX}
          error={errors.company}
          autoComplete="off"
        />
        <SelectField
          label="Where is it now?"
          name="status"
          value={draft.status}
          onChange={(e) => set({ status: e.target.value as ExternalDraft["status"] })}
          options={(["saved", "applied", "interview"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        {draft.status !== "saved" && (
          <TextField
            label="Date applied"
            name="appliedOn"
            type="date"
            max={today}
            value={draft.appliedOn}
            onChange={(e) => set({ appliedOn: e.target.value })}
            hint="Leave empty for today."
            error={errors.appliedOn}
            optional
          />
        )}
        <TextField
          label="Link to the posting"
          name="url"
          type="url"
          inputMode="url"
          value={draft.url}
          onChange={(e) => set({ url: e.target.value })}
          maxLength={URL_MAX}
          placeholder="https://"
          error={errors.url}
          optional
        />
        {f.exp && <p className="text-sm text-muted">Entries you add yourself are for tracking only, so they don&apos;t earn EXP.</p>}
        <Button type="submit" block>
          Add to log
        </Button>
      </form>
    </Sheet>
  );
}
