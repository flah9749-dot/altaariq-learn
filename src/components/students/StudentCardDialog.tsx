import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useServerFn } from "@tanstack/react-start";
import { Printer, Download, MessageCircle, Copy, Check, KeyRound, Loader2, FileDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StudentIdCard } from "./StudentIdCard";
import type { StudentRow } from "@/lib/students-utils";
import { generateStudentPassword } from "@/lib/students-utils";
import { resetStudentPassword } from "@/lib/students.functions";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";
import { useDefaultCountryCode } from "@/hooks/use-default-country-code";
import { buildWaMessage } from "@/lib/whatsapp-templates";
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
  const [localCreds, setLocalCreds] = useState<{ code: string; password: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const resetFn = useServerFn(resetStudentPassword);
  const defaultCountryCode = useDefaultCountryCode();


  const creds = credentials ?? localCreds;

  async function buildMessage(password: string): Promise<string> {
    return buildWaMessage("wa.tpl.student_card", {
      name: student!.full_name,
      code: student!.code,
      password,
      grade: (student as any)?.classes?.name ?? (student as any)?.class_name ?? "—",
      class: (student as any)?.groups?.name ?? (student as any)?.group_name ?? "—",
    });
  }

  async function ensurePassword(): Promise<string | null> {
    if (creds?.password) return creds.password;
    setResetting(true);
    try {
      const pw = generateStudentPassword();
      await resetFn({ data: { id: student!.id, password: pw } });
      setLocalCreds({ code: student!.code, password: pw });
      toast.success("تم توليد كلمة مرور جديدة");
      return pw;
    } catch (e: any) {
      toast.error(e?.message ?? "فشل توليد كلمة المرور");
      return null;
    } finally {
      setResetting(false);
    }
  }

  // Passwords are stored hashed only; reset the dialog state per student so the
  // admin explicitly generates a fresh password when they need to share it.
  useEffect(() => {
    setLocalCreds(null);
  }, [student?.id, open]);

  if (!student) return null;




  // High-DPI card capture (300+ DPI equivalent). Card is 360 CSS px wide,
  // pixelRatio: 4 → 1440 px wide raster ≈ 406 DPI when printed at 90mm.
  async function captureCard(): Promise<string | null> {
    if (!cardRef.current) return null;
    return toPng(cardRef.current, {
      pixelRatio: 4,
      cacheBust: true,
      backgroundColor: "#ffffff",
      quality: 1,
      style: {
        // Force color accuracy on capture; some browsers otherwise sample
        // rendered pixels affected by the OS color profile.
        colorAdjust: "exact",
      } as any,
    });
  }

  async function download() {
    const pw = await ensurePassword();
    if (!pw) return;
    await new Promise((r) => setTimeout(r, 50));
    try {
      const dataUrl = await captureCard();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${student!.code}_card.png`;
      a.click();
      toast.success("تم تحميل الكارت (عالي الدقة)");
    } catch {
      toast.error("فشل التحميل");
    }
  }

  async function downloadPdf() {
    const pw = await ensurePassword();
    if (!pw) return;
    await new Promise((r) => setTimeout(r, 50));
    try {
      const dataUrl = await captureCard();
      if (!dataUrl) return;
      const { jsPDF } = await import("jspdf");
      // Card physical size: 90mm width, height auto from image aspect ratio.
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => (img.onload = res));
      const cardW = 90;
      const cardH = (img.height / img.width) * cardW;
      // A4 portrait, center the card at top with 20mm margin — one page.
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const x = (pageW - cardW) / 2;
      pdf.addImage(dataUrl, "PNG", x, 20, cardW, cardH, undefined, "FAST");
      pdf.save(`${student!.code}_card.pdf`);
      toast.success("تم تحميل PDF");
    } catch {
      toast.error("فشل تحميل PDF");
    }
  }

  async function print() {
    const pw = await ensurePassword();
    if (!pw) return;
    await new Promise((r) => setTimeout(r, 50));
    try {
      const dataUrl = await captureCard();
      if (!dataUrl) return;
      const w = window.open("", "_blank", "width=520,height=760");
      if (!w) { toast.error("السماح بالنوافذ المنبثقة مطلوب للطباعة"); return; }
      // Fixed physical size: 90mm wide, height auto. print-color-adjust:exact
      // guarantees identical colors on Chrome, Edge, Safari, Firefox.
      w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
        <title>${student!.full_name} — بطاقة طالب</title>
        <style>
          @page { size: A4; margin: 15mm; }
          *,*::before,*::after{
            -webkit-print-color-adjust:exact !important;
            print-color-adjust:exact !important;
            color-adjust:exact !important;
          }
          html,body{margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;}
          .wrap{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:24px;}
          .card{width:90mm;height:auto;display:block;border-radius:6mm;box-shadow:0 10px 30px rgba(0,0,0,.15);image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;}
          @media print{
            body{background:#fff}
            .wrap{padding:0;min-height:auto}
            .card{box-shadow:none;border-radius:4mm;page-break-inside:avoid;break-inside:avoid;}
          }
        </style></head>
        <body><div class="wrap"><img class="card" src="${dataUrl}" alt="بطاقة الطالب"/></div>
        <script>
          const img=document.querySelector('img');
          function go(){ setTimeout(()=>{ window.focus(); window.print(); }, 250); }
          if(img.complete) go(); else img.addEventListener('load', go);
        </script></body></html>`);
      w.document.close();
    } catch {
      toast.error("فشل الطباعة");
    }
  }



  async function whatsapp() {
    const rawPhone = student!.parent_whatsapp || student!.parent_phone || "";
    const normalized = normalizePhoneForWhatsApp(rawPhone, defaultCountryCode);
    if (!normalized) { toast.error("لا يوجد رقم واتساب صالح لولي الأمر"); return; }
    const pw = await ensurePassword();
    if (!pw) return;
    const finalMsg = await buildMessage(pw);
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(finalMsg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyCreds() {
    const pw = creds?.password ?? "—";
    const text = `الكود: ${student!.code}\nكلمة المرور: ${pw}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function generatePw() {
    await ensurePassword();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>كارت الطالب 🎓</DialogTitle>
          <DialogDescription>اطبع الكارت، حمّله كصورة، أو أرسل بيانات الدخول لولي الأمر عبر واتساب.</DialogDescription>
        </DialogHeader>


        <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">الكود</span>
            <span dir="ltr" className="font-mono font-semibold">{student.code}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">كلمة المرور</span>
            {creds?.password ? (
              <span dir="ltr" className="font-mono font-semibold text-primary">{creds.password}</span>
            ) : (
              <Button size="sm" variant="outline" onClick={generatePw} disabled={resetting}>
                {resetting ? <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin"/> : <KeyRound className="h-3.5 w-3.5 ml-1"/>}
                توليد كلمة مرور
              </Button>
            )}
          </div>
          {!creds?.password && (
            <p className="text-[11px] text-muted-foreground">
              كلمة المرور محفوظة مشفّرة ولا يمكن استرجاعها — ولّد كلمة جديدة لإرسالها لولي الأمر.
            </p>
          )}
          <Button variant="ghost" size="sm" className="w-full" onClick={copyCreds}>
            {copied ? <Check className="h-4 w-4 ml-1"/> : <Copy className="h-4 w-4 ml-1"/>}
            نسخ بيانات الدخول
          </Button>

        </div>

        <div className="flex justify-center py-2">
          <div ref={cardRef}>
            <StudentIdCard student={student} password={creds?.password ?? null} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={print}><Printer className="h-4 w-4 ml-1"/>طباعة</Button>
            <Button variant="outline" onClick={download}><Download className="h-4 w-4 ml-1"/>PNG</Button>
            <Button variant="outline" onClick={downloadPdf}><FileDown className="h-4 w-4 ml-1"/>PDF</Button>
            <Button onClick={whatsapp} disabled={resetting} className="bg-green-600 hover:bg-green-700 text-white">
              {resetting ? <Loader2 className="h-4 w-4 ml-1 animate-spin"/> : <MessageCircle className="h-4 w-4 ml-1"/>}
              إرسال واتساب
            </Button>

          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
