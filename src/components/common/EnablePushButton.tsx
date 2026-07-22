import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

/** Small button — enables Push on this device. Dynamically imports Firebase
 *  only when actually needed (huge win: ~1MB Firebase bundle stays out of the
 *  initial payload on every page that renders the notifications bell). */
export function EnablePushButton({ variant = "outline", size = "sm" as const, className = "" }: { variant?: "outline"|"ghost"|"default"|"secondary"; size?: "sm"|"default"|"icon"; className?: string }) {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
        if (!cancelled) setSupported(false);
        return;
      }
      const { isPushSupported, getPermission, bootPushIfEnabled, isLocallyDisabled, hasSavedPushDevice } = await import("@/lib/push-notifications");
      const s = await isPushSupported();
      if (cancelled) return;
      setSupported(s);
      const p = getPermission();
      const saved = user ? await hasSavedPushDevice(user.id) : false;
      if (cancelled) return;
      setRegistered(saved && !isLocallyDisabled());
      setPerm(isLocallyDisabled() && p === "granted" ? "default" : p);
      if (s && user && Notification.permission === "granted" && !isLocallyDisabled()) {
        await bootPushIfEnabled(user.id);
        if (!cancelled) setRegistered(await hasSavedPushDevice(user.id));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!supported || !user) return null;

  if (perm === "granted" && registered) {
    return (
      <Button
        variant="ghost"
        size={size}
        className={className}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setRegistered(false);
          setPerm("default");
          try {
            const { disablePush } = await import("@/lib/push-notifications");
            await disablePush(user.id);
          } finally { setLoading(false); }
        }}
        title="اضغط لإيقاف الإشعارات على هذا الجهاز"
      >
        <BellRing className="h-4 w-4 ml-1 text-primary" /> الإشعارات مفعّلة
      </Button>
    );
  }
  if (perm === "denied") {
    return (
      <Button variant="ghost" size={size} className={className} disabled title="الإشعارات محظورة من إعدادات المتصفح">
        <BellOff className="h-4 w-4 ml-1" /> الإشعارات محظورة
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} className={className}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const { enablePush, getPermission, hasSavedPushDevice } = await import("@/lib/push-notifications");
          const token = await enablePush(user.id);
          setPerm(getPermission());
          const saved = await hasSavedPushDevice(user.id);
          setRegistered(!!token && saved);
          if (!token || !saved) toast.error("لم يتم حفظ هذا الجهاز للإشعارات، جرّب مرة أخرى");
        } finally { setLoading(false); }
      }}>
      {loading ? <Loader2 className="h-4 w-4 ml-1 animate-spin"/> : <Bell className="h-4 w-4 ml-1"/>}
      تفعيل إشعارات Push
    </Button>
  );
}
