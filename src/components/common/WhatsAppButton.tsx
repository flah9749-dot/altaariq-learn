import { useEffect, useState } from "react";
import { MessageCircle, Send, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { whatsappUrl, normalizePhoneForWhatsApp } from "@/lib/whatsapp";
import { useDefaultCountryCode } from "@/hooks/use-default-country-code";
import { buildWaMessage, type WaTemplateKey, DEFAULT_WA_TEMPLATES, fillTemplate } from "@/lib/whatsapp-templates";
import { toast } from "sonner";

interface Props {
  phone: string | null | undefined;
  /** Ready message text. Overrides `template` when provided. */
  message?: string;
  /** Template key to auto-build the message (async). */
  template?: WaTemplateKey;
  /** Variables passed to the template. */
  vars?: Record<string, string | number | null | undefined>;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "icon";
  className?: string;
  onClick?: () => void;
  countryCode?: string;
  /** When true, show a preview/edit dialog before opening WhatsApp. Defaults to true. */
  previewable?: boolean;
}

export function WhatsAppButton({
  phone, message, template, vars, label = "تواصل عبر واتساب",
  variant = "default", size = "sm", className = "", onClick, countryCode,
  previewable = true,
}: Props) {
  const defaultCode = useDefaultCountryCode();
  const [resolved, setResolved] = useState<string | undefined>(message);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>("");

  useEffect(() => {
    let alive = true;
    if (message) { setResolved(message); return; }
    if (template) {
      buildWaMessage(template, vars ?? {}).then((m) => { if (alive) setResolved(m); }).catch(() => {
        if (alive) setResolved(fillTemplate(DEFAULT_WA_TEMPLATES[template], { ...(vars ?? {}) }));
      });
    } else {
      setResolved("السلام عليكم ورحمة الله وبركاته 🌿");
    }
    return () => { alive = false; };
  }, [message, template, JSON.stringify(vars ?? {})]);

  const digits = normalizePhoneForWhatsApp(phone, countryCode ?? defaultCode);
  const directUrl = whatsappUrl(phone, resolved, countryCode ?? defaultCode);

  function openPreview(e: React.MouseEvent) {
    e.preventDefault();
    if (!digits) { toast.error("لا يوجد رقم واتساب صالح"); return; }
    setDraft(resolved ?? "");
    setOpen(true);
    onClick?.();
  }

  function sendDraft() {
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(draft)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  function handleDirectClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!digits) { e.preventDefault(); toast.error("لا يوجد رقم واتساب صالح"); return; }
    onClick?.();
  }

  if (!previewable) {
    return (
      <Button
        asChild
        variant={variant}
        size={size}
        className={`gap-2 bg-success text-success-foreground hover:bg-success/90 ${className}`}
      >
        <a href={directUrl ?? "#"} target="_blank" rel="noopener noreferrer" onClick={handleDirectClick}>
          <MessageCircle className="h-4 w-4" />
          {size !== "icon" && <span>{label}</span>}
        </a>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={openPreview}
        className={`gap-2 bg-success text-success-foreground hover:bg-success/90 ${className}`}
      >
        <MessageCircle className="h-4 w-4" />
        {size !== "icon" && <span>{label}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> معاينة رسالة واتساب</DialogTitle>
            <DialogDescription>
              يمكنك تعديل الرسالة قبل إرسالها. سيتم فتح واتساب برقم:
              <span dir="ltr" className="font-mono text-foreground mx-1">+{digits}</span>
            </DialogDescription>
          </DialogHeader>
          <Textarea
            dir="rtl"
            rows={12}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-[system-ui] whitespace-pre-wrap"
          />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraft(resolved ?? "")}>استعادة النص الأصلي</Button>
              <Button onClick={sendDraft} className="bg-success text-success-foreground hover:bg-success/90 gap-2">
                <Send className="h-4 w-4" /> إرسال عبر واتساب
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
