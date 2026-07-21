// Minimal service worker for PWA installability.
// A fetch handler is REQUIRED by Chrome/Edge/Samsung Internet to consider the app installable.
// This SW is intentionally a passthrough (network-only) — no caching — to avoid stale content.
// Push notifications are handled separately by /firebase-messaging-sw.js.

const SW_VERSION = "v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough fetch — required for installability, no caching to prevent stale HTML.
self.addEventListener("fetch", (event) => {
  // Let the browser handle it normally.
  return;
});
