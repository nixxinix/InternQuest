import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardTone = "screen" | "bezel" | "sunken";

const TONES: Record<CardTone, string> = {
  screen: "bg-screen text-ink border border-line",
  bezel: "on-bezel",
  sunken: "bg-canvas text-ink",
};

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "li" | "aside";
  tone?: CardTone;
  padded?: boolean;
};

/** Plain container. Square corners. Pixel framing is opt-in (px-frame) for game panels only. */
export function Card({ as: Tag = "div", tone = "screen", padded = true, className, ...rest }: CardProps) {
  return <Tag className={cn(TONES[tone], padded && "p-4", className)} {...rest} />;
}
