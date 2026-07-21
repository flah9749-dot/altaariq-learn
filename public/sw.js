// One-release cleanup worker for the old app-shell cache.
// School Samsung tablets can keep opening stale cached HTML inside the installed
// shortcut. Keep this file at /sw.js so returning devices receive the cleanup,
// then unregister this app-shell worker. Firebase push notifications use their
// own /firebase-messaging-sw.js worker and are intentionally left untouched.

function isAltareqShellCache(name) {
  if (/firebase|messaging|fcm/i.test(name)) return false;
  return (
    name.startsWith("shell-") ||
    name.startsWith("altareq-shell-") ||
    /(^|-)precache-v\d+-/.test(name) ||
    /(^|-)runtime-/.test(name) ||
    /(^|-)googleAnalytics-/.test(name) ||
    /workbox|app-shell|start-url/i.test(name)
  );
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
