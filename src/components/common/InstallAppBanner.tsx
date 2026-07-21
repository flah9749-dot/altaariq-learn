import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/Logo";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "altareq-install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

/**
 * Floating install banner shown on first app open.
 * - Native install prompt on Android/desktop Chromium.
 * - iOS instructions fallback (Safari has no beforeinstallprompt).
 * - Hidden when installed, dismissed recently, or running inside Lovable iframe.
 */
export function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip inside iframe (Lovable preview)
    try { if (window.top !== window.self) return; } catch { return; }

    // Skip if already installed
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Skip if dismissed recently
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw && Date.now() - Number(raw) < DISMISS_TTL_MS) return;
    } catch { /* ignore */ }

    const ua = window.navigator.userAgent || "";
    // iPadOS 13+ reports as "Macintosh"; detect via touch points as well.
    const isIpadOs = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
    const iOS = (/iPad|iPhone|iPod/.test(ua) || isIpadOs) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(iOS);

    // Show iOS banner immediately (no native event)
    if (iOS) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onBIP as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  };

  const install = async () => {
    if (isIos) { setShowIosHint((v) => !v); return; }
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setVisible(false);
      setDeferred(null);
    } catch { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3 print:hidden" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-primary/20 bg-background/95 backdrop-blur shadow-2xl">
        <div className="flex items-center gap-3 p-3">
          <div className="shrink-0"><Logo size={40} showText={false} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">ثبّت تطبيق الطارق التعليمية</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIos ? "من Safari: زر المشاركة ← إضافة إلى الشاشة الرئيسية" : "الوصول السريع مثل التطبيقات — بدون فتح المتصفح"}
            </p>
          </div>
          <Button size="sm" onClick={install} className="gap-1 shrink-0">
            {isIos ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {isIos ? "طريقة التثبيت" : "تثبيت"}
          </Button>
          <button
            onClick={dismiss}
            className="shrink-0 h-8 w-8 rounded-md text-muted-foreground hover:bg-muted flex items-center justify-center"
            aria-label="إخفاء"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {isIos && showIosHint && (
          <div className="border-t px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            <ol className="list-decimal pr-4 space-y-1">
              <li>افتح المنصة في متصفح <b>Safari</b>.</li>
              <li>اضغط زر <b>المشاركة</b> (المربع مع السهم للأعلى) بأسفل الشاشة.</li>
              <li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم <b>إضافة</b>.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
