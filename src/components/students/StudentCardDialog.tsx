import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useServerFn } from "@tanstack/react-start";
import { Printer, Download, MessageCircle, Copy, Check, KeyRound, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StudentIdCard } from "./StudentIdCard";
import type { StudentRow } from "@/lib/students-utils";
import { generateStudentPassword } from "@/lib/students-utils";
import { resetStudentPassword } from "@/lib/students.functions";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";
import { useDefaultCountryCode } from "@/hooks/use-default-country-code";
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

  if (!student) return null;

  const creds = credentials ?? localCreds;
  const platformName = "منصة الطارق التعليمية";
  const parentGreeting = student.parent_name ? `الأستاذ/ة ${student.parent_name}` : "ولي الأمر الكريم";

  const messageLines = [
    `السلام عليكم ورحمة الله وبركاته 🌸`,
    `أهلاً وسهلاً ${parentGreeting} 👋`,
    ``,
    `يسعدنا انضمام الطالب/ة *${student.full_name}* إلى ${platformName} — منصة الدراسات الاجتماعية (تاريخ • جغرافيا • مواطنة).`,
    ``,
    `🔐 *بيانات الدخول:*`,
    `• الكود: ${student.code}`,
    creds?.password ? `• كلمة المرور: ${creds.password}` : `• كلمة المرور: (يرجى طلبها من المدرس)`,
    ``,
    `📱 يمكنكم متابعة درجات الطالب، الإعلانات، والامتحانات من خلال المنصة.`,
    `نتمنى للطالب/ة التوفيق والنجاح 🌟`,
  ].filter(Boolean).join("\n");

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

  async function download() {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#fff" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${student!.code}_card.png`;
      a.click();
      toast.success("تم تحميل الكارت");
    } catch {
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

  async function whatsapp() {
    const phone = (student!.parent_whatsapp || student!.parent_phone || "").replace(/\D/g, "");
    if (!phone) { toast.error("لا يوجد رقم واتساب لولي الأمر"); return; }
    // Ensure a fresh password exists before sending
    const pw = await ensurePassword();
    if (!pw) return;
    const finalMsg = messageLines.replace(/• كلمة المرور:.*/g, `• كلمة المرور: ${pw}`);
    const normalized = phone.startsWith("0") ? "2" + phone : phone;
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(finalMsg)}`;
    window.open(url, "_blank");
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
      <DialogContent className="max-w-md" dir="rtl">
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
          <Button variant="ghost" size="sm" className="w-full" onClick={copyCreds} disabled={!creds?.password}>
            {copied ? <Check className="h-4 w-4 ml-1"/> : <Copy className="h-4 w-4 ml-1"/>}
            نسخ بيانات الدخول
          </Button>
          {creds?.password && (
            <p className="text-[11px] text-warning">⚠️ احفظ كلمة المرور — لن تظهر مرة أخرى بعد إغلاق النافذة.</p>
          )}
        </div>

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
