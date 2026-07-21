import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { firebaseConfig, VAPID_KEY } from "./firebase-config";

function app() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
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

async function registerSW(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
}

async function saveToken(userId: string, token: string) {
  await supabase.from("push_tokens").upsert(
    { user_id: userId, token, platform: "web", user_agent: navigator.userAgent, last_seen: new Date().toISOString() },
    { onConflict: "user_id,token" },
  );
}

/** Request permission and register the current device for push. Returns the FCM token or null. */
export async function enablePush(userId: string): Promise<string | null> {
  if (!(await isPushSupported())) { toast.error("المتصفح لا يدعم إشعارات Push"); return null; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast.error("لم يتم السماح بالإشعارات"); return null; }
  try {
    const reg = await registerSW();
    const messaging = getMessaging(app());
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) { toast.error("تعذّر الحصول على توكن الإشعارات"); return null; }
    await saveToken(userId, token);
    // Foreground handler — show toast instead of native notification
    onMessage(messaging, (payload) => {
      const t = payload.notification?.title ?? "إشعار جديد";
      const b = payload.notification?.body ?? "";
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
  try {
    const reg = await registerSW();
    const messaging = getMessaging(app());
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) await saveToken(userId, token);
    onMessage(messaging, (payload) => {
      const t = payload.notification?.title ?? "إشعار جديد";
      const b = payload.notification?.body ?? "";
      toast(t, { description: b });
    });
  } catch { /* ignore */ }
}
