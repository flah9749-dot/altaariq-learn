import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { bootPushIfEnabled, enablePush, getPermission, isPushSupported } from "@/lib/push-notifications";

/** Small button — enables Push on this device. Silently attaches listeners if already granted. */
export function EnablePushButton({ variant = "outline", size = "sm" as const, className = "" }: { variant?: "outline"|"ghost"|"default"|"secondary"; size?: "sm"|"default"|"icon"; className?: string }) {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await isPushSupported();
      setSupported(s);
      setPerm(getPermission());
      if (s && user && Notification.permission === "granted") {
        bootPushIfEnabled(user.id);
      }
    })();
  }, [user?.id]);

  if (!supported || !user) return null;

  if (perm === "granted") {
    return (
      <Button variant="ghost" size={size} className={className} disabled>
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
        try { await enablePush(user.id); setPerm(getPermission()); }
        finally { setLoading(false); }
      }}>
      {loading ? <Loader2 className="h-4 w-4 ml-1 animate-spin"/> : <Bell className="h-4 w-4 ml-1"/>}
      تفعيل إشعارات Push
    </Button>
  );
}
