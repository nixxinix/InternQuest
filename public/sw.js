/*
 * InternQuest service worker (Phase 7, PWA).
 *
 * Deliberately small, and private by design: phones are often shared, so it
 * never stores pages, API answers, or anything about the person signed in.
 * It keeps only:
 *   - the built JS, CSS, and fonts (/_next/static, content-hashed, safe to keep), and
 *   - the offline page and the app icons,
 * so the app opens fast on a weak connection and says "You're offline" instead
 * of the browser's error page when there's no connection at all.
 *
 * Bump VERSION to drop old caches after a change to this file.
 */
const VERSION = "v1";
const STATIC_CACHE = `iq-static-${VERSION}`;
const SHELL_CACHE = `iq-shell-${VERSION}`;
const OFFLINE_URL = "/offline";
const SHELL = [OFFLINE_URL, "/icon/192", "/icon/512"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL);
      // The offline page must look right with no connection at all, so its
      // stylesheets are kept too (hashed /_next/static files, safe to keep).
      const page = await shell.match(OFFLINE_URL);
      const html = page ? await page.text() : "";
      const css = [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
      if (css.length) await (await caches.open(STATIC_CACHE)).addAll(css);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Built assets: their names change with their content, so a cached copy is never stale.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Pages: always from the network (never cached, so nothing personal is kept),
  // with the offline page only when the network fails.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
  }
  // Everything else (API, data, images) goes straight to the network.
});
