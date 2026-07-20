import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { adminEmailFromUsername } from "@/lib/auth-emails";
import { setupInitialAdmin, adminInitStatus } from "@/lib/setup.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/common/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";

const Schema = z.object({
  fullName: z.string().trim().min(2, "أدخل الاسم الكامل").max(80),
  username: z.string().trim().min(3, "اسم المستخدم قصير جدًا").max(40).regex(/^[a-zA-Z0-9_.-]+$/, "الحروف الإنجليزية والأرقام فقط"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").max(72),
  confirm: z.string().min(6),
}).refine((d)=>d.password===d.confirm, { message: "كلمتا المرور غير متطابقتين", path: ["confirm"] });

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "تهيئة الأدمن — الطارق التعليمية" }, { name: "robots", content: "noindex" }] }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const runSetup = useServerFn(setupInitialAdmin);
  const checkStatus = useServerFn(adminInitStatus);
  const [checking, setChecking] = useState(true);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [fullName, setFullName] = useState("مدرس الدراسات الاجتماعية");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus({}).then((r) => setAlreadyExists(r.hasAdmin)).finally(() => setChecking(false));
  }, [checkStatus]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Schema.safeParse({ fullName, username, password, confirm });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      await runSetup({ data: { username: parsed.data.username, password: parsed.data.password, fullName: parsed.data.fullName } });
      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmailFromUsername(parsed.data.username),
        password: parsed.data.password,
      });
      if (error) { toast.success("تم إنشاء الحساب. سجّل الدخول الآن."); navigate({ to: "/login" }); return; }
      toast.success("تم إنشاء حساب الأدمن وتسجيل الدخول");
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div className="absolute top-4 left-4"><ThemeToggle /></div>
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo size={64} /></div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>تهيئة حساب الأدمن</CardTitle>
            <CardDescription>هذه الخطوة تتم لمرة واحدة فقط لإنشاء حساب المدرس.</CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/></div>
            ) : alreadyExists ? (
              <div className="space-y-4 text-center">
                <p className="text-sm">تم إعداد حساب الأدمن مسبقًا.</p>
                <Button asChild className="w-full"><Link to="/login">الذهاب لتسجيل الدخول</Link></Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">الاسم الكامل</Label>
                  <Input id="fullName" value={fullName} onChange={(e)=>setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input id="username" value={username} onChange={(e)=>setUsername(e.target.value)} dir="ltr" className="text-left" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} dir="ltr" className="text-left" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
                  <Input id="confirm" type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} dir="ltr" className="text-left" />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : "إنشاء الحساب"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
