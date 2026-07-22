import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, deleteToken } from "firebase/messaging";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { firebaseConfig, VAPID_KEY } from "./firebase-config";
import { getFirebaseApiKey } from "./firebase-config.functions";


let cachedApiKey: string | null = null;
async function resolveApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  const { apiKey } = await getFirebaseApiKey();
  if (!apiKey) throw new Error("Firebase API key غير مُعدّ على الخادم");
  cachedApiKey = apiKey;
  return apiKey;
}

async function app() {
  if (getApps().length) return getApp();
  const apiKey = await resolveApiKey();
  return initializeApp({ ...firebaseConfig, apiKey });
}

export async function isPushSupported(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) return false;
    return await isSupported();
  } catch { return false; }
}

export function getPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

const LOCAL_DISABLED_KEY = "push_locally_disabled_v1";
const FCM_SCOPE = "/firebase-cloud-messaging-push-scope/";
export function isLocallyDisabled(): boolean {
  try { return typeof window !== "undefined" && localStorage.getItem(LOCAL_DISABLED_KEY) === "1"; } catch { return false; }
}
export function setPushLocallyDisabled(v: boolean) {
  try {
    if (typeof window === "undefined") return;
    if (v) localStorage.setItem(LOCAL_DISABLED_KEY, "1");
    else localStorage.removeItem(LOCAL_DISABLED_KEY);
  } catch {}
}

async function registerSW(): Promise<ServiceWorkerRegistration> {
  const apiKey = await resolveApiKey();
  const swUrl = `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(apiKey)}`;
  // Always call register with the current URL so older devices update away from
  // stale workers that were installed with an old/missing Firebase apiKey.
  const reg = await navigator.serviceWorker.register(swUrl, { scope: FCM_SCOPE });
  // getToken/PushManager.subscribe require an ACTIVE service worker.
  if (!reg.active) {
    await new Promise<void>((resolve) => {
      const sw = reg.installing || reg.waiting;
      if (!sw) return resolve();
      const onChange = () => {
        if (sw.state === "activated") {
          sw.removeEventListener("statechange", onChange);
          resolve();
        }
      };
      sw.addEventListener("statechange", onChange);
    });
  }
  await navigator.serviceWorker.ready;
  return reg;
}

async function getExistingSW(): Promise<ServiceWorkerRegistration | undefined> {
  try { return await navigator.serviceWorker.getRegistration(FCM_SCOPE); } catch { return undefined; }
}

async function saveToken(userId: string, token: string) {
  const { error } = await supabase.from("push_tokens").upsert(
    { user_id: userId, token, platform: "web", user_agent: navigator.userAgent, last_seen: new Date().toISOString() },
    { onConflict: "user_id,token" },
  );
  if (error) throw new Error(`تعذّر حفظ جهاز الإشعارات: ${error.message}`);
}

export async function hasSavedPushDevice(userId: string): Promise<boolean> {
  if (!userId || typeof navigator === "undefined") return false;
  const { data, error } = await supabase
    .from("push_tokens")
    .select("id")
    .eq("user_id", userId)
    .eq("user_agent", navigator.userAgent)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/** Request permission and register the current device for push. Returns the FCM token or null. */
export async function enablePush(userId: string): Promise<string | null> {
  if (!(await isPushSupported())) { toast.error("المتصفح لا يدعم إشعارات Push"); return null; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast.error("لم يتم السماح بالإشعارات"); return null; }
  try {
    const reg = await registerSW();
    const messaging = getMessaging(await app());
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) { toast.error("تعذّر الحصول على توكن الإشعارات"); return null; }
    await saveToken(userId, token);
    setPushLocallyDisabled(false);
    // Foreground handler — show toast instead of native notification
    onMessage(messaging, (payload) => {
      const t = payload.notification?.title ?? payload.data?.title ?? "إشعار جديد";
      const b = payload.notification?.body ?? payload.data?.body ?? "";
      toast(t, { description: b });
    });
    toast.success("تم تفعيل إشعارات Push على هذا الجهاز");
    return token;
  } catch (e: any) {
    toast.error(e?.message ?? "فشل تفعيل الإشعارات");
    return null;
  }
}

/** Silent boot: if permission is already granted, refresh token & attach foreground listener. */
export async function bootPushIfEnabled(userId: string) {
  if (!(await isPushSupported())) return;
  if (Notification.permission !== "granted") return;
  if (isLocallyDisabled()) return;
  try {
    const reg = await registerSW();
    const messaging = getMessaging(await app());
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) await saveToken(userId, token);
    onMessage(messaging, (payload) => {
      const t = payload.notification?.title ?? payload.data?.title ?? "إشعار جديد";
      const b = payload.notification?.body ?? payload.data?.body ?? "";
      toast(t, { description: b });
    });
  } catch (e: any) {
    console.warn("Push token refresh failed", e?.message ?? e);
  }
}

/** Disable push on this device: delete FCM token locally and remove it from the DB. */
export async function disablePush(userId: string): Promise<boolean> {
  setPushLocallyDisabled(true);
  try {
    let currentToken: string | null = null;
    if (await isPushSupported()) {
      try {
        const reg = await getExistingSW();
        if (!reg) throw new Error("no existing push worker");
        const messaging = getMessaging(await app());
        try {
          currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
        } catch { /* ignore */ }
        try { await deleteToken(messaging); } catch { /* ignore */ }
        try {
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
    if (currentToken) {
      await supabase.from("push_tokens").delete().eq("user_id", userId).eq("token", currentToken);
    } else {
      // Fallback: remove all tokens saved from this browser (best effort).
      await supabase.from("push_tokens").delete().eq("user_id", userId).eq("user_agent", navigator.userAgent);
    }
    toast.success("تم إيقاف الإشعارات على هذا الجهاز");
    return true;
  } catch (e: any) {
    toast.error(e?.message ?? "تعذّر إيقاف الإشعارات");
    return false;
  }
}

