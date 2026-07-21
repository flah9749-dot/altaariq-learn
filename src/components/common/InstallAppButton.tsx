import { useEffect, useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Install App button — captures `beforeinstallprompt`, offers manual install.
 * Shows iOS instructions on Safari/iOS where the API doesn't exist.
 */
export function InstallAppButton({
  variant = "outline",
  size = "sm" as const,
  className = "",
}: {
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default" | "icon";
  className?: string;
}) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect standalone (already installed)
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    // iOS detection (no beforeinstallprompt on Safari)
    const ua = window.navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(iOS);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      toast.success("تم تثبيت التطبيق بنجاح");
    };
    window.addEventListener("beforeinstallprompt", onBIP as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <Button variant="ghost" size={size} className={className} disabled>
        <CheckCircle2 className="h-4 w-4 ml-1 text-primary" /> التطبيق مثبت
      </Button>
    );
  }

  const handleClick = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setDeferred(null);
      } catch {
        toast.error("تعذّر بدء التثبيت");
      }
      return;
    }
    if (isIos) {
      toast("للتثبيت على iPhone/iPad", {
        description: "اضغط زر المشاركة في Safari ثم اختر «إضافة إلى الشاشة الرئيسية»",
        duration: 8000,
      });
      return;
    }
    toast("التطبيق غير جاهز للتثبيت الآن", {
      description: "افتح المنصة من متصفح Chrome أو Edge بعد استخدامها لبضع ثوانٍ، وستظهر أيقونة التثبيت في شريط العنوان.",
      duration: 8000,
    });
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick}>
      <Download className="h-4 w-4 ml-1" /> تثبيت التطبيق
    </Button>
  );
}
