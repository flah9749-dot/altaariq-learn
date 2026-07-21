import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Printer, Download, MessageCircle, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StudentIdCard } from "./StudentIdCard";
import type { StudentRow } from "@/lib/students-utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  student: StudentRow | null;
  credentials?: { code: string; password: string } | null;
}

export function StudentCardDialog({ open, onOpenChange, student, credentials }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  if (!student) return null;

  const platformName = "منصة الطارق التعليمية";
  const messageLines = [
    `مرحباً ${student.parent_name || "ولي الأمر الكريم"} 👋`,
    `تم إضافة الطالب/ة *${student.full_name}* إلى ${platformName}.`,
    "",
    "🔐 بيانات الدخول:",
    `• الكود: ${student.code}`,
    credentials?.password ? `• كلمة المرور: ${credentials.password}` : "",
    "",
    `يمكنكم متابعة الدرجات والإعلانات من خلال المنصة.`,
  ].filter(Boolean).join("\n");

  async function download() {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#fff" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${student!.code}_card.png`;
      a.click();
      toast.success("تم تحميل الكارت");
    } catch (e: any) {
      toast.error("فشل التحميل");
    }
  }

  function print() {
    const html = cardRef.current?.outerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><title>${student!.full_name}</title>
      <script src="https://cdn.tailwindcss.com"></script></head>
      <body class="flex items-center justify-center min-h-screen bg-white p-4">${html}
      <script>setTimeout(()=>{window.print();},400);</script></body></html>`);
    w.document.close();
  }

  function whatsapp() {
    const phone = (student!.parent_whatsapp || student!.parent_phone || "").replace(/\D/g, "");
    if (!phone) { toast.error("لا يوجد رقم واتساب لولي الأمر"); return; }
    const normalized = phone.startsWith("0") ? "2" + phone : phone;
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(messageLines)}`;
    window.open(url, "_blank");
  }

  async function copyCreds() {
    const text = `الكود: ${student!.code}\nكلمة المرور: ${credentials?.password ?? "—"}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تم إضافة الطالب بنجاح 🎉</DialogTitle>
          <DialogDescription>يمكنك طباعة الكارت، تحميله كصورة، أو إرساله لولي الأمر عبر واتساب.</DialogDescription>
        </DialogHeader>

        {credentials && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">الكود</span>
              <span className="font-mono font-semibold">{credentials.code}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">كلمة المرور</span>
              <span className="font-mono font-semibold">{credentials.password}</span>
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-2" onClick={copyCreds}>
              {copied ? <Check className="h-4 w-4 ml-1"/> : <Copy className="h-4 w-4 ml-1"/>}
              نسخ بيانات الدخول
            </Button>
          </div>
        )}

        <div className="flex justify-center py-2">
          <div ref={cardRef}>
            <StudentIdCard student={student} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={print}><Printer className="h-4 w-4 ml-1"/>طباعة</Button>
            <Button variant="outline" onClick={download}><Download className="h-4 w-4 ml-1"/>تحميل</Button>
            <Button onClick={whatsapp} className="bg-green-600 hover:bg-green-700 text-white">
              <MessageCircle className="h-4 w-4 ml-1"/>إرسال واتساب
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
