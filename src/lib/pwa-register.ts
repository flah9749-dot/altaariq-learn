// Register the messaging service worker eagerly so browsers detect PWA installability.
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
  if (new URL(window.location.href).searchParams.get("sw") === "off") return;
  navigator.serviceWorker
    .register("/firebase-messaging-sw.js", { scope: "/" })
    .catch(() => { /* ignore */ });
}
