import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GraduationCap, Loader2, CheckCircle2, ArrowLeft, ArrowRight, Copy, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/common/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { validateJoinCode, submitRegistration } from "@/lib/self-registration.functions";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "التسجيل الذاتي — الطارق التعليمية" },
      { name: "description", content: "أنشئ حسابك في منصة الطارق التعليمية باستخدام كود الانضمام الخاص بمجموعتك." },
      { property: "og:title", content: "التسجيل الذاتي — الطارق التعليمية" },
      { property: "og:description", content: "أنشئ حسابك في المنصة عبر كود الانضمام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

// Country codes commonly used in the region. Egypt is default.
const COUNTRY_CODES: { cc: string; label: string; flag: string }[] = [
  { cc: "20",  label: "مصر",            flag: "🇪🇬" },
  { cc: "966", label: "السعودية",       flag: "🇸🇦" },
  { cc: "971", label: "الإمارات",       flag: "🇦🇪" },
  { cc: "965", label: "الكويت",         flag: "🇰🇼" },
  { cc: "974", label: "قطر",            flag: "🇶🇦" },
  { cc: "973", label: "البحرين",        flag: "🇧🇭" },
  { cc: "968", label: "عُمان",          flag: "🇴🇲" },
  { cc: "962", label: "الأردن",         flag: "🇯🇴" },
  { cc: "963", label: "سوريا",          flag: "🇸🇾" },
  { cc: "961", label: "لبنان",          flag: "🇱🇧" },
  { cc: "964", label: "العراق",         flag: "🇮🇶" },
  { cc: "967", label: "اليمن",          flag: "🇾🇪" },
  { cc: "970", label: "فلسطين",         flag: "🇵🇸" },
  { cc: "218", label: "ليبيا",          flag: "🇱🇾" },
  { cc: "216", label: "تونس",           flag: "🇹🇳" },
  { cc: "213", label: "الجزائر",        flag: "🇩🇿" },
  { cc: "212", label: "المغرب",         flag: "🇲🇦" },
  { cc: "249", label: "السودان",        flag: "🇸🇩" },
];

function combineWithCC(cc: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  if (!digits) return "";
  const noZero = digits.replace(/^0+/, "");
  return `+${cc}${noZero}`;
}

function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState("");
  const [codeInfo, setCodeInfo] = useState<{ class_name: string; group_name: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const [fullName, setFullName] = useState("");
  const [studentCC, setStudentCC] = useState("20");
  const [studentPhone, setStudentPhone] = useState("");
  const [parentCC, setParentCC] = useState("20");
  const [parentPhone, setParentPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState<any>(null);

  const validate = useServerFn(validateJoinCode);
  const submit = useServerFn(submitRegistration);
  const autoRan = useRef(false);

  const runCheck = async (rawCode: string) => {
    if (rawCode.trim().length < 2) { toast.error("أدخل كود الانضمام"); return; }
    setChecking(true);
    try {
      const r: any = await validate({ data: { code: rawCode.trim() } });
      if (!r?.valid) { toast.error(r?.reason ?? "كود غير صالح"); return; }
      setCodeInfo({ class_name: r.class_name, group_name: r.group_name });
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التحقق من الكود");
    } finally { setChecking(false); }
  };

  // Auto-fill and auto-validate from URL `?code=` param.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("code");
    if (p) {
      const up = p.toUpperCase();
      setCode(up);
      if (!autoRan.current) {
        autoRan.current = true;
        runCheck(up);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCheck(code);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().split(/\s+/).length < 4) { toast.error("أدخل الاسم رباعياً"); return; }
    if (!consent) { toast.error("يجب الموافقة على الشروط"); return; }
    const sPhone = combineWithCC(studentCC, studentPhone);
    const pPhone = combineWithCC(parentCC, parentPhone);
    if (!sPhone || sPhone.length < 8) { toast.error("رقم هاتف الطالب غير صحيح"); return; }
    if (!pPhone || pPhone.length < 8) { toast.error("رقم هاتف ولي الأمر غير صحيح"); return; }
    setSubmitting(true);
    try {
      const r: any = await submit({
        data: {
          code: code.trim(),
          full_name: fullName.trim(),
          student_phone: sPhone,
          parent_phone: pPhone,
          parent_name: parentName.trim() || null,
          consent: true,
        },
      });
      setResult(r);
      setStep(3);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل إنشاء الحساب");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col" dir="rtl">
      <div className="absolute top-4 left-4 z-10"><ThemeToggle /></div>
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center"><Logo size={64} /></div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-2">
              <GraduationCap className="h-7 w-7 text-primary" /> التسجيل لأول مرة
            </h1>
            <p className="text-sm text-muted-foreground">
              أنشئ حسابك في المنصة عبر كود الانضمام الذي أعطاك إياه المدرس.
            </p>
          </div>

          <Steps step={step} />

          <Card className="shadow-lg border-border/60">
            <CardContent className="p-6">
              {step === 1 && (
                <form onSubmit={onCheck} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">كود الانضمام</Label>
                    <Input
                      id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="G1-A-2026" dir="ltr" className="text-center text-lg font-mono tracking-wider"
                      autoFocus autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">أدخل الكود كما هو مكتوب لك.</p>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={checking}>
                    {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />}
                    التحقق من الكود
                  </Button>
                </form>
              )}

              {step === 2 && codeInfo && (
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                    <p><span className="text-muted-foreground">الصف:</span> <b>{codeInfo.class_name}</b></p>
                    <p><span className="text-muted-foreground">المجموعة:</span> <b>{codeInfo.group_name}</b></p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">الاسم رباعياً *</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
                  </div>

                  <PhoneField
                    id="studentPhone" label="رقم هاتف الطالب *"
                    cc={studentCC} onCcChange={setStudentCC}
                    value={studentPhone} onChange={setStudentPhone}
                  />
                  <PhoneField
                    id="parentPhone" label="رقم هاتف ولي الأمر *"
                    cc={parentCC} onCcChange={setParentCC}
                    value={parentPhone} onChange={setParentPhone}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="parentName">اسم ولي الأمر (اختياري)</Label>
                    <Input id="parentName" value={parentName} onChange={(e) => setParentName(e.target.value)} maxLength={80} />
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                    <span>أوافق على شروط الاستخدام وسياسة الخصوصية الخاصة بمنصة الطارق التعليمية.</span>
                  </label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-2">
                      <ArrowRight className="h-4 w-4" /> رجوع
                    </Button>
                    <Button type="submit" className="flex-1 gap-2" disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      إنشاء الحساب
                    </Button>
                  </div>
                </form>
              )}

              {step === 3 && result && <SuccessView result={result} />}
            </CardContent>
          </Card>

          <p className="text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">لديك حساب بالفعل؟ تسجيل الدخول</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function PhoneField({
  id, label, cc, onCcChange, value, onChange,
}: {
  id: string; label: string;
  cc: string; onCcChange: (v: string) => void;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2" dir="ltr">
        <Select value={cc} onValueChange={onCcChange}>
          <SelectTrigger className="w-[130px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {COUNTRY_CODES.map((c) => (
              <SelectItem key={c.cc} value={c.cc}>
                <span className="font-mono">+{c.cc}</span> <span className="ms-1 text-muted-foreground">{c.flag} {c.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id} value={value} onChange={(e) => onChange(e.target.value)}
          required inputMode="tel" placeholder="1xxxxxxxxx" className="flex-1"
        />
      </div>
      <p className="text-[11px] text-muted-foreground text-right">
        اختر رمز الدولة ثم أدخل الرقم بدون الصفر الأول. الافتراضي: مصر 🇪🇬 (+20).
      </p>
    </div>
  );
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = ["الكود", "البيانات", "النتيجة"];
  return (
    <div className="flex items-center justify-center gap-2">
      {items.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
              done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
            }`}>{n}</div>
            <span className={`text-xs ${active ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
            {n < 3 && <div className={`h-px w-6 ${done ? "bg-primary" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function SuccessView({ result }: { result: any }) {
  const navigate = useNavigate();
  if (result.status === "pending") {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-warning/20 text-warning flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold">تم استلام طلبك</h3>
        <p className="text-sm text-muted-foreground">{result.message}</p>
        <Button onClick={() => navigate({ to: "/login" })} className="mt-4">العودة لتسجيل الدخول</Button>
      </div>
    );
  }
  const c = result.credentials;
  const copy = (v: string, l: string) => { navigator.clipboard.writeText(v); toast.success(`تم نسخ ${l}`); };
  const goLogin = () => navigate({ to: "/login", search: { code: c?.code } as any });
  return (
    <div className="space-y-4 py-2">
      <div className="text-center space-y-2">
        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold">تم إنشاء حسابك بنجاح!</h3>
        <p className="text-sm text-muted-foreground">احفظ بياناتك التالية في مكان آمن.</p>
      </div>
      <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
        <Row label="كود الطالب" value={c.code} onCopy={() => copy(c.code, "الكود")} />
        <Row label="كلمة المرور" value={c.password} onCopy={() => copy(c.password, "كلمة المرور")} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {result.whatsapp?.parent && (
          <Button asChild variant="outline" className="gap-2">
            <a href={result.whatsapp.parent} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> إرسال لولي الأمر
            </a>
          </Button>
        )}
        {result.whatsapp?.student && (
          <Button asChild variant="outline" className="gap-2">
            <a href={result.whatsapp.student} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> إرسال لهاتفي
            </a>
          </Button>
        )}
      </div>
      <Button onClick={goLogin} className="w-full">الانتقال لتسجيل الدخول</Button>
    </div>
  );
}
function Row({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="font-mono font-bold text-sm" dir="ltr">{value}</code>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCopy}><Copy className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
