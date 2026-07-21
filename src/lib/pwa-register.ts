// Clean up the old app-shell Service Worker that could serve stale files inside
// installed shortcuts on managed Samsung tablets. Home-screen support now relies
// on the manifest only; Firebase push notifications keep their separate worker.
const CLEANUP_MARKER = "altareq-app-shell-cleanup-v2";

function isAppShellCache(name: string) {
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

export function registerInstallabilityServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const cleanupCaches = () => {
    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys
          .filter(isAppShellCache)
          .forEach((key) => caches.delete(key).catch(() => {}));
      }).catch(() => {});
    }
  };

  const unregisterAppShellWorker = () => {
    cleanupCaches();
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((reg) => {
        const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
        if (scriptUrl.endsWith("/sw.js")) reg.unregister().catch(() => {});
      });
    });
  };

  try {
    if (window.top !== window.self) {
      unregisterAppShellWorker();
      return;
    }
  } catch {
    unregisterAppShellWorker();
    return;
  }
  const host = window.location.hostname;
  const blocked =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  if (!import.meta.env.PROD || blocked || new URL(window.location.href).searchParams.get("sw") === "off") {
    unregisterAppShellWorker();
    return;
  }

  cleanupCaches();
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    const hasOldAppShellWorker = regs.some((reg) => {
      const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
      return scriptUrl.endsWith("/sw.js");
    });
    if (!hasOldAppShellWorker) return;
    try {
      if (localStorage.getItem(CLEANUP_MARKER) === "done") {
        unregisterAppShellWorker();
        return;
      }
      localStorage.setItem(CLEANUP_MARKER, "done");
    } catch { /* ignore */ }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => unregisterAppShellWorker());
  }).catch(() => cleanupCaches());
}
