// Register a minimal service worker at "/sw.js" so Chrome/Edge/Samsung Internet
// consider the app installable (they require a SW with a fetch handler at the
// top-level scope). The Firebase messaging SW is registered separately when
// the user enables push notifications; it does not itself satisfy the
// installability requirement.
//
// Guarded to avoid running inside Lovable preview/dev iframes.
export function registerInstallabilityServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  try {
    if (window.top !== window.self) return;
  } catch {
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
  if (blocked) return;
  if (new URL(window.location.href).searchParams.get("sw") === "off") {
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}));
    });
    return;
  }
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .catch(() => { /* ignore */ });
}
