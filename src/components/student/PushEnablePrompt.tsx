import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const DISMISS_KEY = "push_prompt_dismissed_at";
const DISMISS_DAYS = 3;

/**
 * Banner that lets students enable browser push notifications when permission
 * is still "default", and — once granted — shows a small chip so they can
 * disable notifications on this device whenever they want.
 */
export function PushEnablePrompt() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return;
      try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (raw) {
          const days = (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24);
          if (days < DISMISS_DAYS) setDismissed(true);
        }
      } catch {}
      const { isPushSupported, getPermission, bootPushIfEnabled } = await import("@/lib/push-notifications");
      const s = await isPushSupported();
      if (cancelled) return;
      setSupported(s);
      setPerm(getPermission());
      if (s && user && Notification.permission === "granted") {
        bootPushIfEnabled(user.id);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!supported || !user) return null;

  // Already enabled — show a small "disable" chip.
  if (perm === "granted") {
    return (
      <div className="mx-auto mb-3 flex max-w-6xl items-center justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const { disablePush } = await import("@/lib/push-notifications");
              const ok = await disablePush(user.id);
              if (ok) {
                try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
                setDismissed(true);
                toast.message("لإعادة التفعيل لاحقاً، اسمح بالإشعارات من إعدادات المتصفح.");
              }
            } finally { setLoading(false); }
          }}
          className="gap-2"
        >
          <BellOff className="h-4 w-4" />
          {loading ? "جارٍ الإيقاف..." : "إيقاف الإشعارات"}
        </Button>
      </div>
    );
  }

  if (perm !== "default" || dismissed) return null;

  return (
    <div className="mx-auto mb-3 flex max-w-6xl items-center gap-3 rounded-xl border border-primary/30 bg-gradient-to-l from-primary/10 to-secondary/10 p-3 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Bell className="h-5 w-5" />
      </div>
      <div className="flex-1 text-sm">
        <div className="font-semibold text-foreground">فعّل الإشعارات لتصلك تنبيهات الامتحانات والنتائج</div>
        <div className="text-xs text-muted-foreground">حتى وأنت خارج التطبيق — لن تفوتك أي رسالة أو امتحان جديد.</div>
      </div>
      <Button
        size="sm"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const { enablePush, getPermission } = await import("@/lib/push-notifications");
            const token = await enablePush(user.id);
            setPerm(getPermission());
            if (token) toast.success("تم تفعيل الإشعارات ✅");
          } finally { setLoading(false); }
        }}
      >
        {loading ? "جارٍ التفعيل..." : "تفعيل الآن"}
      </Button>
      <button
        aria-label="إخفاء"
        className="rounded-md p-1 text-muted-foreground hover:bg-background/60"
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
          setDismissed(true);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
