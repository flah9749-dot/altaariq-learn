// Calibrates the client-server clock skew so that "relativeTime" doesn't
// show a wrong "منذ N د" when the user's device clock drifts from real time.
import { setServerClockSkew } from "@/lib/message-utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

async function calibrateOnce(): Promise<boolean> {
  try {
    const url = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/health` : window.location.origin;
    const t0 = Date.now();
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const t1 = Date.now();
    const dateHeader = res.headers.get("date");
    if (!dateHeader) return false;
    const serverMs = new Date(dateHeader).getTime();
    if (!Number.isFinite(serverMs)) return false;
    // Best estimate: server time at the midpoint of the round-trip.
    const clientMidpoint = t0 + (t1 - t0) / 2;
    setServerClockSkew(serverMs - clientMidpoint);
    return true;
  } catch {
    return false;
  }
}

let started = false;
export function startClockSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  void calibrateOnce();
  // Re-calibrate every 15 min and whenever the tab becomes visible again.
  setInterval(() => { void calibrateOnce(); }, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void calibrateOnce();
  });
}
