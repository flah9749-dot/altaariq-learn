// Central HTTP security hardening for every response leaving the Worker.
// Applied in src/server.ts (SSR entry) so it covers pages, server functions and API routes.

const SUPABASE_ORIGIN = "https://zafilibrplthhqzoporw.supabase.co";
const SUPABASE_WS = "wss://zafilibrplthhqzoporw.supabase.co";

/**
 * Paths that must never be served, even if a build accidentally emits them.
 * Matched case-insensitively against the URL pathname.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)\.github(\/|$)/i,
  /(^|\/)\.env($|\.|\/)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)(package|package-lock)\.json$/i,
  /(^|\/)(yarn\.lock|pnpm-lock\.yaml|bun\.lock|bun\.lockb)$/i,
  /(^|\/)tsconfig[^/]*\.json$/i,
  /(^|\/)vite\.config\.[cm]?[jt]s$/i,
  /(^|\/)(eslint\.config|components|bunfig|nitro|wrangler)\.[^/]+$/i,
  /(^|\/)readme(\.md)?$/i,
  /(^|\/)agents\.md$/i,
  /(^|\/)api\.md$/i,
  /(^|\/)(supabase|load-tests|\.lovable)(\/|$)/i,
  /\.map$/i,
  /\.(sql|pem|key|crt|p12|bak|sh|log)$/i,
];

export function isBlockedPath(pathname: string): boolean {
  const p = decodeURIComponent(pathname);
  return BLOCKED_PATTERNS.some((re) => re.test(p));
}

/** Lovable preview/sandbox hosts must stay framable, otherwise the editor preview breaks. */
function isPreviewHost(host: string): boolean {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.includes("-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("sandbox")
  );
}

function buildCsp(preview: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // TanStack Start injects inline hydration scripts; pdf/QR libs need wasm.
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    // Tailwind/shadcn inject runtime style tags; Google Fonts stylesheet.
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    "img-src": ["'self'", "data:", "blob:", SUPABASE_ORIGIN, "https:"],
    "media-src": ["'self'", "blob:", SUPABASE_ORIGIN],
    "connect-src": [
      "'self'",
      SUPABASE_ORIGIN,
      SUPABASE_WS,
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
      "https://fcm.googleapis.com",
      "https://fcmregistrations.googleapis.com",
      "https://firebaseinstallations.googleapis.com",
    ],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "frame-ancestors": preview ? ["https://*.lovable.app", "https://*.lovableproject.com", "'self'"] : ["'none'"],
  };
  const out = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!preview) out.push("upgrade-insecure-requests");
  return out.join("; ");
}

const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "ambient-light-sensor=()",
  "autoplay=()",
  "battery=()",
  "bluetooth=()",
  "browsing-topics=()",
  "display-capture=()",
  "encrypted-media=()",
  "gamepad=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "idle-detection=()",
  "local-fonts=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
  // Camera is required for the in-app QR scanner and chat camera capture.
  "camera=(self)",
  "fullscreen=(self)",
].join(", ");

export function applySecurityHeaders(response: Response, request: Request): Response {
  const host = new Request(request.url).headers.get("host") ?? new URL(request.url).host;
  const preview = isPreviewHost(host);

  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", buildCsp(preview));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Origin-Agent-Cluster", "?1");

  if (!preview) {
    headers.set("X-Frame-Options", "DENY");
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    // Public API routes are meant to be consumed cross-origin; everything else is same-origin only.
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/public/")) {
      headers.set("Cross-Origin-Resource-Policy", "same-origin");
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function blockedResponse(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
