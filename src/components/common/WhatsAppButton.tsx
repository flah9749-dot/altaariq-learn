import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";

interface Props { phone: string | null | undefined; message?: string; label?: string; variant?: "default" | "outline" | "ghost" | "secondary"; size?: "sm" | "default" | "icon"; className?: string; onClick?: () => void; }

export function WhatsAppButton({ phone, message, label = "تواصل عبر واتساب", variant = "default", size = "sm", className = "", onClick }: Props) {
  const url = whatsappUrl(phone, message);
  if (!url) return null;
  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={`gap-2 bg-success text-success-foreground hover:bg-success/90 ${className}`}
    >
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        <MessageCircle className="h-4 w-4" />
        {size !== "icon" && <span>{label}</span>}
      </a>
    </Button>
  );
}
