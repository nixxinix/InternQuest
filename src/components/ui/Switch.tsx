"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

type SwitchProps = {
  label: string;
  /** One line under the label: what changes when it's on or off. */
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/**
 * On/off setting. A native button with role="switch", so Space and Enter work
 * and screen readers say "on" or "off". The state is also written as text,
 * never shown by color or position alone. The whole row is the tap target.
 */
export function Switch({ label, description, checked, onChange, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex min-h-tap items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className={cn("block text-base font-semibold", disabled && "text-muted")}>
          {label}
        </label>
        {description && (
          <p id={`${id}-d`} className="text-sm text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex min-h-tap flex-none items-center gap-2 px-1 disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span aria-hidden="true" className="w-7 text-right text-sm font-semibold">
          {checked ? "On" : "Off"}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "relative block h-7 w-12 border-2 transition-colors duration-(--motion-fast)",
            checked ? "border-green bg-green" : "border-muted bg-canvas",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 block size-5 transition-[left] duration-(--motion-fast)",
              checked ? "left-[1.375rem] bg-screen" : "left-0.5 bg-muted",
            )}
          />
        </span>
      </button>
    </div>
  );
}
