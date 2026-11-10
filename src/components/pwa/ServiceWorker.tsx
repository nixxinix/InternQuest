"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js in production builds only (in development it would
 * keep serving stale built files while you edit). Failure is harmless: the
 * site works the same without it, just without the offline page.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
