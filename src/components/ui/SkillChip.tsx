import { cn } from "@/lib/cn";
import { PixelIcon } from "./PixelIcon";

type SkillChipProps = {
  name: string;
  state: "matched" | "missing" | "neutral";
  className?: string;
};

/**
 * Read-only skill chip. Matched and missing differ in fill, border style
 * (solid vs dashed) AND icon (check vs plus), never by color alone.
 * Lists of chips should carry a visible label ("Missing skills").
 */
export function SkillChip({ name, state, className }: SkillChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-sm",
        state === "matched" && "bg-green-tint font-medium text-green",
        state === "missing" && "border border-dashed border-muted bg-screen text-ink",
        state === "neutral" && "bg-canvas text-ink",
        className,
      )}
    >
      {state === "matched" && <PixelIcon name="check" scale={2} />}
      {state === "missing" && <PixelIcon name="plus" scale={2} />}
      {name}
    </span>
  );
}
