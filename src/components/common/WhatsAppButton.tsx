import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function WhatsAppButton({
  phone, message, template, vars, label = "تواصل عبر واتساب",
  variant = "default", size = "sm", className = "", onClick, countryCode,
}: Props) {
  const defaultCode = useDefaultCountryCode();
  const [resolved, setResolved] = useState<string | undefined>(message);

  // When a template is used (and no explicit message), resolve it eagerly so the
  // button becomes a plain <a> — some browsers (Safari) block window.open from an
  // async click handler.
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

  const url = whatsappUrl(phone, resolved, countryCode ?? defaultCode);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const digits = normalizePhoneForWhatsApp(phone, countryCode ?? defaultCode);
    if (!digits) {
      e.preventDefault();
      toast.error("لا يوجد رقم واتساب صالح");
      return;
    }
    onClick?.();
  };

  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={`gap-2 bg-success text-success-foreground hover:bg-success/90 ${className}`}
    >
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
      >
        <MessageCircle className="h-4 w-4" />
        {size !== "icon" && <span>{label}</span>}
      </a>
    </Button>
  );
}
