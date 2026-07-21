// Minimal installable Service Worker with app-shell fallback.
// A fetch handler is REQUIRED by Chrome/Edge/Samsung Internet for installability.
// We cache index.html so the installed app always boots (even on flaky networks),
// then always try the network first for fresh content (NetworkFirst navigations).
// Push notifications are handled separately by /firebase-messaging-sw.js.

const SW_VERSION = "v5";
const SHELL_CACHE = `shell-${SW_VERSION}`;
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        await cache.add(new Request(SHELL_URL, { cache: "reload" }));
      } catch {
        /* ignore install errors */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old shell caches from previous versions.
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith("shell-") && k !== SHELL_CACHE)
            .map((k) => caches.delete(k)),
        );
      } catch {
        /* ignore */
      }
      await self.clients.claim();
    })(),
  );
});

// NetworkFirst for navigations, with cached index.html fallback so the
// installed app never shows a "stopped" / blank crash screen.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Firebase Messaging or SW files themselves.
  if (url.pathname === "/firebase-messaging-sw.js" || url.pathname === "/sw.js") return;

  const isNavigation =
    req.mode === "navigate" ||
    (req.destination === "" && req.headers.get("accept")?.includes("text/html"));

  if (!isNavigation) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Update cached shell on the fly.
        if (fresh && fresh.ok && (url.pathname === "/" || url.pathname === "/index.html")) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(SHELL_URL, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(SHELL_URL);
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>الطارق</title><body style="font-family:sans-serif;padding:2rem;text-align:center" dir="rtl">تعذّر الاتصال بالإنترنت. حاول مرة أخرى.</body>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
    })(),
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
