import { cn } from "@/lib/cn";
import { litSegments } from "@/lib/game/progress";

type SegmentBarProps = {
  value: number;
  max: number;
  segments?: number;
  /** "light" for screen/canvas surfaces, "bezel" for the dark console. */
  surface?: "light" | "bezel";
  height?: "sm" | "md";
  className?: string;
  /** When true, lit segments light up one after another (pixel fill). */
  stagger?: boolean;
};

/**
 * The pixel "HP bar". Purely visual: always pair it with a text value
 * ("86% match", "340 / 500 EXP"). It is hidden from screen readers.
 */
export function SegmentBar({
  value,
  max,
  segments = 10,
  surface = "light",
  height = "md",
  className,
  stagger = false,
}: SegmentBarProps) {
  const lit = litSegments(value, max, segments);
  return (
    <div aria-hidden="true" className={cn("flex gap-[3px]", height === "sm" ? "h-2" : "h-3", className)}>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 transition-colors duration-(--motion-instant)",
            i < lit
              ? surface === "bezel"
                ? "bg-lime"
                : "bg-green"
              : surface === "bezel"
                ? "bg-bezel-track"
                : "bg-line",
          )}
          style={stagger ? { transitionDelay: `${i * 30}ms` } : undefined}
        />
      ))}
    </div>
  );
}
