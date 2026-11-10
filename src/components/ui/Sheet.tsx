"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./Button";
import { PixelIcon } from "./PixelIcon";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * Bottom sheet on phones, centered dialog from 640px up. Native <dialog>,
 * so focus trapping, Escape, and focus return come from the browser.
 */
export function Sheet({ open, onClose, title, description, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="mb-0 mt-auto w-full max-w-full bg-transparent p-0 text-ink sm:m-auto sm:w-[min(28rem,calc(100%-2rem))]"
    >
      <div className="animate-rise border-t-4 border-bezel bg-screen px-gutter pb-6 pt-3 sm:border-4 sm:shadow-raised">
        <div className="flex items-start justify-between gap-2">
          <div className="pt-2">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-base text-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" className="-mr-2" onClick={() => ref.current?.close()}>
            <PixelIcon name="close" scale={2} />
          </IconButton>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
