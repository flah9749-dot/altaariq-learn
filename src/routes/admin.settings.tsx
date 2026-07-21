import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings, Save, Palette, FileText, MessageSquare, Trophy, Shield, Database, Download, Loader2, UserCog, Plus, Trash2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AvatarUploader } from "@/components/common/AvatarUploader";
import { useAuth } from "@/lib/auth-context";
import { adminEmailFromUsername } from "@/lib/auth-emails";
import { createAdmin, deleteAdmin, resetAdminPassword } from "@/lib/admin-account.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — لوحة المدرس" }] }),
  component: SettingsPage,
});

type SettingsMap = Record<string, any>;

async function fetchSettings(): Promise<SettingsMap> {
  const { data } = await supabase.from("settings").select("key,value");
  const map: SettingsMap = {};
  (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
  return map;
}

async function saveSettings(entries: [string, any][]) {
  const rows = entries.map(([key, value]) => ({ key, value }));
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [local, setLocal] = useState<SettingsMap>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => { if (settings) setLocal(settings); }, [settings]);

  const set = (k: string, v: any) => {
    setLocal((s) => ({ ...s, [k]: v }));
    setDirty((d) => new Set(d).add(k));
  };

  const save = useMutation({
    mutationFn: async () => {
      const entries: [string, any][] = Array.from(dirty).map((k) => [k, local[k]]);
      await saveSettings(entries);
    },
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      setDirty(new Set());
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-12"/><Skeleton className="h-96"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Settings className="h-7 w-7 text-primary" />الإعدادات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة إعدادات المنصة والحساب</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={dirty.size === 0 || save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 ml-1 animate-spin"/> : <Save className="h-4 w-4 ml-1"/>}
          حفظ التغييرات {dirty.size > 0 && `(${dirty.size})`}
        </Button>
      </div>

      <Tabs defaultValue="identity" dir="rtl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="identity"><Palette className="h-4 w-4 ml-1"/>الهوية</TabsTrigger>
          <TabsTrigger value="account"><UserCog className="h-4 w-4 ml-1"/>الحساب</TabsTrigger>
          <TabsTrigger value="exams"><FileText className="h-4 w-4 ml-1"/>الامتحانات</TabsTrigger>
          <TabsTrigger value="messages"><MessageSquare className="h-4 w-4 ml-1"/>الرسائل</TabsTrigger>
          <TabsTrigger value="rewards"><Trophy className="h-4 w-4 ml-1"/>الجوائز</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-4 w-4 ml-1"/>الأمان</TabsTrigger>
          <TabsTrigger value="backup"><Database className="h-4 w-4 ml-1"/>النسخ الاحتياطي</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <AccountPanel />
        </TabsContent>


        {/* Identity */}
        <TabsContent value="identity" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>هوية المنصة</CardTitle><CardDescription>الاسم والوصف الذي يظهر للمستخدمين</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Field label="اسم المنصة" k="platform.name" val={local["platform.name"]} onChange={set} />
              <Field label="الشعار / الوصف" k="platform.tagline" val={local["platform.tagline"]} onChange={set} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exams */}
        <TabsContent value="exams" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>إعدادات الامتحانات الافتراضية</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumField label="الزمن الافتراضي (دقيقة)" k="exam.default_duration_min" val={local["exam.default_duration_min"]} onChange={set} />
              <NumField label="درجة النجاح %" k="exam.default_pass_score" val={local["exam.default_pass_score"]} onChange={set} />
              <NumField label="عدد المحاولات الافتراضي" k="exam.default_attempts" val={local["exam.default_attempts"]} onChange={set} />
              <ToggleField label="ترتيب الأسئلة عشوائيًا" k="exam.shuffle_questions" val={local["exam.shuffle_questions"]} onChange={set} />
              <ToggleField label="ترتيب الاختيارات عشوائيًا" k="exam.shuffle_options" val={local["exam.shuffle_options"]} onChange={set} />
              <ToggleField label="السماح بالمراجعة قبل التسليم" k="exam.allow_review" val={local["exam.allow_review"]} onChange={set} />
              <ToggleField label="إظهار النتيجة فور التسليم" k="exam.show_result_immediately" val={local["exam.show_result_immediately"]} onChange={set} />
              <ToggleField label="تفعيل مكافحة الغش" k="exam.anti_cheat" val={local["exam.anti_cheat"]} onChange={set} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>إعدادات الرسائل</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumField label="الحد الأقصى لحجم الملف (MB)" k="messages.max_file_mb" val={local["messages.max_file_mb"]} onChange={set} />
              <NumField label="مدة الاحتفاظ بالرسائل (أيام)" k="messages.retention_days" val={local["messages.retention_days"]} onChange={set} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards */}
        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>إعدادات نظام الجوائز</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <ToggleField label="تفعيل نظام النقاط" k="rewards.points_enabled" val={local["rewards.points_enabled"]} onChange={set} />
              <ToggleField label="تفعيل الشارات" k="rewards.badges_enabled" val={local["rewards.badges_enabled"]} onChange={set} />
              <ToggleField label="تفعيل المستويات" k="rewards.levels_enabled" val={local["rewards.levels_enabled"]} onChange={set} />
              <ToggleField label="تفعيل متجر الجوائز" k="rewards.shop_enabled" val={local["rewards.shop_enabled"]} onChange={set} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>إعدادات الأمان</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumField label="مدة الجلسة (ساعات)" k="security.session_hours" val={local["security.session_hours"]} onChange={set} />
              <NumField label="الحد الأقصى لمحاولات الدخول" k="security.max_login_attempts" val={local["security.max_login_attempts"]} onChange={set} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>المصادقة الثنائية</CardTitle><CardDescription>جاهزة للتفعيل مستقبلًا</CardDescription></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">ستتم إضافة دعم 2FA في تحديث لاحق.</p></CardContent>
          </Card>
        </TabsContent>

        {/* Backup */}
        <TabsContent value="backup" className="space-y-4">
          <BackupPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, k, val, onChange }: { label: string; k: string; val: any; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={val ?? ""} onChange={(e) => onChange(k, e.target.value)} />
    </div>
  );
}
function NumField({ label, k, val, onChange }: { label: string; k: string; val: any; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" value={val ?? ""} onChange={(e) => onChange(k, Number(e.target.value))} />
    </div>
  );
}
function ToggleField({ label, k, val, onChange }: { label: string; k: string; val: any; onChange: (k: string, v: any) => void }) {
  return (
    <div className="flex items-center justify-between border rounded-lg p-3">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={!!val} onCheckedChange={(v) => onChange(k, v)} />
    </div>
  );
}

function BackupPanel() {
  const [busy, setBusy] = useState(false);
  const [lastAt, setLastAt] = useState<string | null>(() => localStorage.getItem("last_backup_at"));

  const doBackup = async () => {
    setBusy(true);
    try {
      const tables = ["students","classes","groups","exams","questions","question_options","exam_attempts","attempt_answers","points_log","badges","student_badges","achievements","student_achievements","rewards","reward_catalog","reward_redemptions","levels","announcements","message_templates","settings","point_rules","competitions","competition_participants"];
      const dump: Record<string, any> = { exportedAt: new Date().toISOString(), version: 1, tables: {} };
      for (const t of tables) {
        const { data, error } = await supabase.from(t as any).select("*");
        if (error) throw new Error(`${t}: ${error.message}`);
        dump.tables[t] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taariq-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = new Date().toISOString();
      localStorage.setItem("last_backup_at", now);
      setLastAt(now);
      toast.success("تم إنشاء وتنزيل النسخة الاحتياطية");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل إنشاء النسخة");
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary"/>النسخ الاحتياطي</CardTitle>
        <CardDescription>تصدير كامل بيانات المنصة كملف JSON للحفظ الآمن</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border rounded-lg p-4">
          <div>
            <p className="font-medium">إنشاء نسخة احتياطية الآن</p>
            <p className="text-sm text-muted-foreground">
              {lastAt ? `آخر نسخة: ${new Date(lastAt).toLocaleString("ar-EG")}` : "لم يتم إنشاء نسخة بعد"}
            </p>
          </div>
          <Button onClick={doBackup} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 ml-1 animate-spin"/> : <Download className="h-4 w-4 ml-1"/>}
            تنزيل النسخة
          </Button>
        </div>
        <div className="text-xs text-muted-foreground border-r-2 border-primary pr-3">
          الاستعادة والجدولة التلقائية ستتوفر في تحديث لاحق. احتفظ بالنسخ في مكان آمن.
        </div>
      </CardContent>
    </Card>
  );
}
