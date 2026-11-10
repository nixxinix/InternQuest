import type { Metadata } from "next";
import { buttonClasses } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false },
};

/**
 * Shown by the service worker (public/sw.js) when a page can't load because
 * there's no connection. Static and self-contained: no data, no account, and
 * it works without JavaScript (the scripts may not be cached yet).
 */
export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-gutter py-16 text-center">
      <PixelIcon name="alert" scale={5} className="text-muted" />
      <h1 className="mt-4 text-2xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 text-base text-muted">
        InternQuest needs a connection to load listings and your quest log. Check your data or Wi-Fi, then try again.
      </p>
      {/* An empty href reloads the address the person was trying to open (the service worker shows this page in its place). */}
      <a href="" className={`mt-6 ${buttonClasses({ size: "lg" })}`}>
        Try again
      </a>
    </main>
  );
}
