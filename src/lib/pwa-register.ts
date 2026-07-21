// Clean up the old app-shell Service Worker that could serve stale files inside
// installed shortcuts on managed Samsung tablets. Home-screen support now relies
// on the manifest only; Firebase push notifications keep their separate worker.
export function registerInstallabilityServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const unregisterAppShellWorker = () => {
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

  unregisterAppShellWorker();
}
