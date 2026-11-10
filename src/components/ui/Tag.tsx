import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PixelIcon } from "./PixelIcon";

type TagTone = "verified" | "source" | "deadline" | "neutral" | "hud";

const TONES: Record<TagTone, string> = {
  verified: "text-green font-semibold",
  source: "text-muted",
  deadline: "text-alert font-semibold",
  neutral: "bg-canvas text-ink px-2",
  hud: "font-pixel uppercase text-hud-sm text-lime",
};

const ICONS: Partial<Record<TagTone, ReactNode>> = {
  verified: <PixelIcon name="check" scale={2} />,
  deadline: <PixelIcon name="clock" scale={2} />,
};

/** Small inline label. Meaning is always in the text; the icon only supports it. */
export function Tag({ tone = "neutral", children, className }: { tone?: TagTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", TONES[tone], className)}>
      {ICONS[tone]}
      {children}
    </span>
  );
}
