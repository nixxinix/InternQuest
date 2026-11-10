"use client";

import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PixelIcon } from "./PixelIcon";

/* Shared look: 16px text (no iOS zoom), 44px tall, 2px muted border (5.7:1),
   alert border plus a text message when invalid. */
const CONTROL =
  "block w-full min-h-tap border-2 border-muted bg-screen px-3 text-base text-ink placeholder:text-muted aria-invalid:border-alert";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  /** Live feedback under the control (e.g. "Checking...", a strength meter). Announced politely. */
  status?: ReactNode;
  children: ReactNode;
};

function FieldShell({ id, label, hint, error, optional, status, children }: FieldShellProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
      {status !== undefined && !error && (
        <div id={`${id}-status`} aria-live="polite" className="text-sm">
          {status}
        </div>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-alert">
          <PixelIcon name="alert" scale={2} className="mt-0.5" />
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string, status?: boolean) {
  return (
    [hint && `${id}-hint`, status && !error && `${id}-status`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined
  );
}

type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  status?: ReactNode;
};

export function TextField({ label, hint, error, optional, status, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} status={status}>
      <input
        id={id}
        className={cn(CONTROL, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error, status !== undefined)}
        required={!optional}
        {...rest}
      />
    </FieldShell>
  );
}

export function PasswordField({
  label,
  hint,
  error,
  status,
  className,
  ...rest
}: Omit<TextFieldProps, "type" | "optional">) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} status={status}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={cn(CONTROL, "pr-14", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error, status !== undefined)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          {...rest}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-ink"
        >
          <PixelIcon name="eye" scale={3} />
        </button>
      </div>
    </FieldShell>
  );
}

type SelectFieldProps = Omit<ComponentPropsWithoutRef<"select">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  options: { value: string; label: string }[];
};

export function SelectField({ label, hint, error, optional, options, className, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        className={cn(CONTROL, "appearance-auto", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "id"> & {
  label: ReactNode;
  error?: string;
};

/** Native checkbox (keeps keyboard and screen reader behavior) with a square pixel look. */
export function Checkbox({ label, error, className, ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex min-h-tap cursor-pointer items-start gap-3 py-2">
        <span className="relative mt-0.5 flex-none">
          <input
            id={id}
            type="checkbox"
            className={cn(
              "peer block size-6 cursor-pointer appearance-none border-2 border-ink bg-screen checked:bg-green aria-invalid:border-alert",
              className,
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            {...rest}
          />
          <PixelIcon
            name="check"
            scale={2}
            className="pointer-events-none absolute left-1 top-1 hidden text-screen peer-checked:block"
          />
        </span>
        <span className="text-base">{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-alert">
          <PixelIcon name="alert" scale={2} className="mt-0.5" />
          {error}
        </p>
      )}
    </div>
  );
}

type ChipPickerProps = {
  legend: string;
  hint?: string;
  /** Option values (e.g. skill ids). */
  options: string[];
  /** Display text per value. Defaults to the value itself. */
  labels?: Record<string, string>;
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
};

/** Skill picker. Each chip is a toggle button (aria-pressed), 44px tall. */
export function ChipPicker({ legend, hint, options, labels, value, onChange, max }: ChipPickerProps) {
  const id = useId();
  const full = typeof max === "number" && value.length >= max;
  return (
    <fieldset aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onChange(on ? value.filter((v) => v !== opt) : [...value, opt])}
              className={cn(
                "inline-flex min-h-tap items-center gap-1.5 border-2 px-3 text-base transition-colors duration-(--motion-fast)",
                "disabled:cursor-not-allowed disabled:opacity-50",
                on ? "border-green bg-green font-semibold text-screen" : "border-muted bg-screen text-ink hover:border-ink",
              )}
            >
              <PixelIcon name={on ? "check" : "plus"} scale={2} />
              {labels?.[opt] ?? opt}
            </button>
          );
        })}
      </div>
      {typeof max === "number" && (
        <p className="mt-2 text-sm text-muted" aria-live="polite">
          {value.length} of {max} picked
        </p>
      )}
    </fieldset>
  );
}
