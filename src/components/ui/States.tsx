import type { ReactNode } from "react";
import { PixelIcon } from "./PixelIcon";
import type { SpriteName } from "./sprites";

type StateProps = {
  title: string;
  body: string;
  action?: ReactNode;
  sprite?: SpriteName;
};

/** Nothing here yet. Always says why, and gives one next step. */
export function EmptyState({ title, body, action, sprite = "chest" }: StateProps) {
  return (
    <div className="flex flex-col items-center border-2 border-dashed border-muted bg-screen px-6 py-8 text-center">
      <PixelIcon name={sprite} scale={5} className="text-ink [--sprite-accent:var(--color-line)]" />
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-1 max-w-prose text-base text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Something failed. Says what happened in plain words, never blames the
 * user, and offers a retry. Rendered in place of the failed content.
 */
export function ErrorState({ title, body, action, sprite = "alert" }: StateProps) {
  return (
    <div className="flex flex-col items-center border-l-4 border-alert bg-alert-tint px-6 py-8 text-center">
      <PixelIcon name={sprite} scale={5} className="text-alert" />
      <h3 className="mt-4 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-prose text-base text-ink">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
