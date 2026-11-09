"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";

/** Catches unexpected errors in any page. Plain words, no blame, a way forward. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto w-full max-w-xl flex-1 px-gutter py-section">
      <ErrorState
        title="Something went wrong on our side"
        body="Your saved listings and quest log are safe. Try again, or go back to the listings."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>Try again</Button>
            <ButtonLink href="/" variant="secondary">
              Back to listings
            </ButtonLink>
          </div>
        }
      />
    </main>
  );
}
