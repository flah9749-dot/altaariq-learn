// One-release cleanup worker for the old app-shell cache.
// The school Samsung tablets were opening stale cached HTML inside the installed
// shortcut. Keep this file at /sw.js so returning devices receive the cleanup,
// then unregister this app-shell worker. Firebase push notifications use their
// own /firebase-messaging-sw.js worker and are intentionally left untouched.

function isAltareqShellCache(name) {
  return name.startsWith("shell-") || name.startsWith("altareq-shell-");
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(
          cacheNames.filter(isAltareqShellCache).map((name) => caches.delete(name)),
        );
        await self.clients.claim();
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(clients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});
