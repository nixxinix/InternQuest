"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useFeatures } from "@/components/providers/GameModeProvider";
import { PixelIcon } from "./PixelIcon";

type ToastTone = "neutral" | "success" | "error";

export type ToastInput = {
  message: string;
  tone?: ToastTone;
  /** EXP gained. Shown only in modes that show EXP; the message must make sense without it. */
  exp?: number;
  action?: { label: string; onClick: () => void };
  /** ms. Defaults: 4000, or 7000 when there is an action (time to reach Undo). */
  duration?: number;
};

type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setItems((all) => [...all.slice(-(MAX_VISIBLE - 1)), { ...t, id }]);
  }, []);

  const polite = useMemo(() => items.filter((t) => t.tone !== "error"), [items]);
  const urgent = useMemo(() => items.filter((t) => t.tone === "error"), [items]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Above the mobile bottom nav; bottom-right on desktop. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-gutter lg:bottom-6 lg:items-end">
        <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 lg:items-end">
          {polite.map((t) => (
            <Toast key={t.id} item={t} onDone={dismiss} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex w-full flex-col items-center gap-2 lg:items-end">
          {urgent.map((t) => (
            <Toast key={t.id} item={t} onDone={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}

function Toast({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const features = useFeatures();
  const [paused, setPaused] = useState(false);
  const duration = item.duration ?? (item.action ? 7000 : 4000);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDone(item.id), duration);
    return () => clearTimeout(timer);
  }, [paused, duration, item.id, onDone]);

  const icon = item.tone === "error" ? "alert" : item.tone === "success" ? "check" : null;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "on-bezel pointer-events-auto flex w-full max-w-sm animate-rise items-center gap-3 px-4 py-3 shadow-raised",
        item.tone === "error" && "border-l-4 border-alert",
      )}
    >
      {icon && <PixelIcon name={icon} scale={3} className={item.tone === "error" ? "text-screen" : "text-lime"} />}
      <p className="flex-1 text-base font-semibold">
        {item.message}
        {features.exp && item.exp ? (
          <span className="ml-2 font-pixel text-hud-sm uppercase text-lime">+{item.exp} EXP</span>
        ) : null}
      </p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDone(item.id);
          }}
          className="min-h-tap px-2 font-semibold text-lime underline decoration-2 underline-offset-4"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDone(item.id)}
        className="flex size-tap flex-none items-center justify-center text-bezel-text hover:text-screen"
      >
        <PixelIcon name="close" scale={2} />
      </button>
    </div>
  );
}
