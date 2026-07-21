import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { adminEmailFromUsername, studentEmailFromCode } from "@/lib/auth-emails";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Logo } from "@/components/common/Logo";
import { InstallAppButton } from "@/components/common/InstallAppButton";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { adminInitStatus } from "@/lib/setup.functions";

const AdminSchema = z.object({
  username: z.string().trim().min(2, "أدخل اسم المستخدم"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});
const StudentSchema = z.object({
  code: z.string().trim().min(2, "أدخل كود الطالب"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});

const REMEMBER_KEY = "altareq-remember";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — الطارق التعليمية" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const checkAdmin = useServerFn(adminInitStatus);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    checkAdmin({}).then((r) => { setNeedsSetup(!r.hasAdmin); }).finally(() => setCheckingSetup(false));
  }, [checkAdmin]);

  useEffect(() => {
    if (user && role === "admin") navigate({ to: "/admin/dashboard", replace: true });
    else if (user && role === "student") navigate({ to: "/student/dashboard", replace: true });
  }, [user, role, navigate]);

  return (
    <div className="min-h-dvh w-full bg-background" dir="rtl">
      <div className="absolute top-4 left-4 z-10"><ThemeToggle /></div>
      <div className="grid min-h-dvh lg:grid-cols-2">
        {/* Visual side */}
        <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 p-12">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px, 90px 90px",
          }} />
          <div className="relative max-w-md text-primary-foreground space-y-8 text-center">
            <div className="flex justify-center">
              <Logo size={80} showText={false} className="scale-110" />
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold">الطارق التعليمية</h1>
              <p className="text-lg text-primary-foreground/80">منصة الدراسات الاجتماعية</p>
              <p className="text-primary-foreground/60 leading-relaxed">تاريخ • جغرافيا • مواطنة — تجربة تعلم حديثة مدعومة بالذكاء الاصطناعي.</p>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-6">
              {[{n:"امتحانات",v:"ذكية"},{n:"نقاط",v:"وجوائز"},{n:"تقارير",v:"مباشرة"}].map((x)=>(
                <div key={x.n} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-sm text-primary-foreground/70">{x.n}</p>
                  <p className="mt-1 font-bold text-gold">{x.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form side */}
        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md space-y-6">
            <div className="lg:hidden flex justify-center"><Logo size={56} /></div>
            <div className="flex justify-center"><InstallAppButton variant="outline" /></div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">تسجيل الدخول</h2>
              <p className="text-sm text-muted-foreground">اختر نوع الحساب ثم أدخل بياناتك</p>
            </div>

            {needsSetup && !checkingSetup && (
              <Card className="border-warning/40 bg-warning/10">
                <CardContent className="p-4 text-sm space-y-2">
                  <p className="font-semibold text-warning-foreground">لم يتم تهيئة المدرس (الأدمن) بعد.</p>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/setup">تهيئة حساب الأدمن الآن</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-lg border-border/60">
              <CardContent className="p-6">
                <Tabs defaultValue="student" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="admin" className="gap-2"><ShieldCheck className="h-4 w-4"/>المدرس</TabsTrigger>
                    <TabsTrigger value="student" className="gap-2"><GraduationCap className="h-4 w-4"/>الطالب</TabsTrigger>
                  </TabsList>
                  <TabsContent value="admin" className="mt-6">
                    <AdminLoginForm />
                  </TabsContent>
                  <TabsContent value="student" className="mt-6">
                    <StudentLoginForm />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">© {new Date().getFullYear()} الطارق التعليمية — جميع الحقوق محفوظة</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.role === "admin" && s?.identifier) setUsername(s.identifier);
      }
    } catch { /* ignore */ }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = AdminSchema.safeParse({ username, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const email = adminEmailFromUsername(parsed.data.username);
      const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
      if (error) { toast.error("بيانات الدخول غير صحيحة"); return; }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ role: "admin", identifier: parsed.data.username }));
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* ignore */ }
      toast.success("تم تسجيل الدخول بنجاح");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="admin-username">اسم المستخدم</Label>
        <Input id="admin-username" autoComplete="username" value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="admin" dir="ltr" className="text-left" />
      </div>
      <PasswordField id="admin-password" value={password} onChange={setPassword} show={showPass} onToggle={()=>setShowPass(v=>!v)} />
      <RememberRow remember={remember} onChange={setRemember} />
      <SubmitBtn loading={loading} label="دخول لوحة التحكم" />
    </form>
  );
}

function StudentLoginForm() {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.role === "student" && s?.identifier) setCode(s.identifier);
      }
    } catch { /* ignore */ }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = StudentSchema.safeParse({ code, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const email = studentEmailFromCode(parsed.data.code);
      const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
      if (error) { toast.error("كود الطالب أو كلمة المرور غير صحيحة"); return; }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ role: "student", identifier: parsed.data.code }));
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* ignore */ }
      toast.success("مرحبًا بك");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="student-code">كود الطالب</Label>
        <Input id="student-code" autoComplete="username" value={code} onChange={(e)=>setCode(e.target.value)} placeholder="ST-000123" dir="ltr" className="text-left" />
      </div>
      <PasswordField id="student-password" value={password} onChange={setPassword} show={showPass} onToggle={()=>setShowPass(v=>!v)} />
      <RememberRow remember={remember} onChange={setRemember} />
      <SubmitBtn loading={loading} label="دخول لوحة الطالب" />
    </form>
  );
}

function PasswordField({ id, value, onChange, show, onToggle }: { id: string; value: string; onChange: (v:string)=>void; show: boolean; onToggle: ()=>void; }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>كلمة المرور</Label>
      <div className="relative">
        <Input id={id} type={show?"text":"password"} autoComplete="current-password" value={value} onChange={(e)=>onChange(e.target.value)} dir="ltr" className="pe-10 text-left" />
        <button type="button" onClick={onToggle} className="absolute inset-y-0 end-2 my-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label={show?"إخفاء":"إظهار"}>
          {show ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
        </button>
      </div>
    </div>
  );
}

function RememberRow({ remember, onChange }: { remember: boolean; onChange: (v: boolean)=>void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="remember" checked={remember} onCheckedChange={(v)=>onChange(!!v)} />
      <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">تذكرني</Label>
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <LogIn className="h-4 w-4"/>}
      {loading ? "جاري تسجيل الدخول..." : label}
    </Button>
  );
}
