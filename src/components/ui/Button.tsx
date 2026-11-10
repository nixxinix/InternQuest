import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "hud";
export type ButtonSize = "md" | "lg";

type StyleOptions = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

const VARIANTS: Record<ButtonVariant, string> = {
  // Console button: solid, with a darker bottom edge that flattens when pressed.
  primary:
    "bg-green text-screen shadow-bevel hover:bg-green-press active:shadow-bevel-pressed active:translate-y-px",
  secondary: "bg-screen text-ink border-2 border-ink hover:bg-canvas active:translate-y-px",
  ghost: "text-green underline underline-offset-4 decoration-2 hover:decoration-4",
  danger:
    "bg-alert text-screen shadow-bevel active:shadow-bevel-pressed active:translate-y-px",
  // Only on the bezel (level-up card, HUD). Lime is never used on light surfaces.
  hud: "bg-lime text-ink font-pixel uppercase text-hud shadow-bevel active:shadow-bevel-pressed active:translate-y-px",
};

export function buttonClasses({ variant = "primary", size = "md", block = false }: StyleOptions = {}) {
  return cn(
    "relative inline-flex select-none items-center justify-center gap-2 font-semibold",
    "transition-[translate,background-color,box-shadow] duration-(--motion-fast)",
    "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
    size === "md" ? "min-h-tap px-4" : "min-h-12 px-6",
    // hud sets its own pixel font size; two font-size utilities would conflict.
    variant !== "hud" && (size === "md" ? "text-base" : "text-lg"),
    block && "w-full",
    VARIANTS[variant],
  );
}

function Spinner() {
  return (
    <span aria-hidden="true" className="inline-flex gap-0.5">
      <span className="size-1.5 animate-shimmer bg-current" />
      <span className="size-1.5 animate-shimmer bg-current [animation-delay:200ms]" />
      <span className="size-1.5 animate-shimmer bg-current [animation-delay:400ms]" />
    </span>
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> &
  StyleOptions & {
    /** Shows a pixel spinner, keeps the label, and blocks double submits. */
    loading?: boolean;
    icon?: ReactNode;
  };

export function Button({
  variant,
  size,
  block,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & StyleOptions & { icon?: ReactNode };

export function ButtonLink({ variant, size, block, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses({ variant, size, block }), className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** Square icon-only button. Always needs a label for screen readers. */
export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...rest
}: ComponentPropsWithoutRef<"button"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex size-tap flex-none items-center justify-center text-current hover:bg-ink/5 active:translate-y-px",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
