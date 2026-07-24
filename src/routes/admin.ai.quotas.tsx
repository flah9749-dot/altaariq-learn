import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RefreshCw, Search, Infinity as InfinityIcon, Trash2 } from "lucide-react";
import {
  listQuotaPolicies,
  upsertQuotaPolicy,
  searchUsersForQuota,
  getUserQuotaStatus,
  upsertUserOverride,
  resetUserQuota,
  getQuotaLeaderboard,
} from "@/lib/ai-quotas.functions";

export const Route = createFileRoute("/admin/ai/quotas")({
  head: () => ({ meta: [{ title: "حصص الذكاء الاصطناعي — الطارق التعليمية" }] }),
  component: QuotasPage,
});

const FEATURE_LABEL: Record<string, string> = {
  assistant_message: "رسائل المساعد",
  file_upload: "رفع الملفات للتحليل",
  exam_generation: "توليد الامتحانات",
  essay_grading: "تصحيح المقالي",
  summary: "الملخصات",
  lesson_explain: "شرح الدروس",
  map_analysis: "تحليل الخرائط",
  content_plan: "خطط دراسية",
};
const PERIOD_LABEL: Record<string, string> = { daily: "يومي", weekly: "أسبوعي", monthly: "شهري" };

function QuotasPage() {
  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">حصص الذكاء الاصطناعي</h1>
        <p className="text-sm text-muted-foreground">إدارة السياسات الافتراضية، الاستثناءات، ومتابعة الاستهلاك.</p>
      </div>
      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies">السياسات الافتراضية</TabsTrigger>
          <TabsTrigger value="users">استثناءات المستخدمين</TabsTrigger>
          <TabsTrigger value="leaderboard">الأكثر استهلاكاً</TabsTrigger>
        </TabsList>
        <TabsContent value="policies" className="mt-4"><PoliciesTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="leaderboard" className="mt-4"><LeaderboardTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Policies ---------------- */

function PoliciesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listQuotaPolicies);
  const upsertFn = useServerFn(upsertQuotaPolicy);
  const { data, isLoading } = useQuery({ queryKey: ["quota-policies"], queryFn: () => listFn() });
  const mut = useMutation({
    mutationFn: (payload: any) => upsertFn({ data: payload }),
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["quota-policies"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  const rows = (data ?? []) as any[];
  const students = rows.filter(r => r.role === "student");
  const admins = rows.filter(r => r.role === "admin");

  return (
    <div className="space-y-4">
      <PolicyGroup title="الطالب" rows={students} onSave={(p) => mut.mutate({ ...p, role: "student" })} />
      <PolicyGroup title="المعلم" rows={admins} onSave={(p) => mut.mutate({ ...p, role: "admin" })} />
    </div>
  );
}

function PolicyGroup({ title, rows, onSave }: { title: string; rows: any[]; onSave: (r: any) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <PolicyRow key={r.id} row={r} onSave={onSave} />
        ))}
      </CardContent>
    </Card>
  );
}

function PolicyRow({ row, onSave }: { row: any; onSave: (r: any) => void }) {
  const [limit, setLimit] = useState<number>(row.limit_count ?? 0);
  const [period, setPeriod] = useState<string>(row.period ?? "daily");
  const [enabled, setEnabled] = useState<boolean>(row.enabled !== false);
  const [fileMb, setFileMb] = useState<string>(row.max_file_mb?.toString() ?? "");
  const [pages, setPages] = useState<string>(row.max_pages?.toString() ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2 border rounded p-2 text-sm">
      <div className="min-w-[10rem] font-medium">{FEATURE_LABEL[row.feature] ?? row.feature}</div>
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="daily">يومي</SelectItem>
          <SelectItem value="weekly">أسبوعي</SelectItem>
          <SelectItem value="monthly">شهري</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1"><Label className="text-xs">الحد</Label>
        <Input type="number" className="w-24" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
      </div>
      <div className="flex items-center gap-1"><Label className="text-xs">ملف MB</Label>
        <Input type="number" className="w-20" value={fileMb} onChange={(e) => setFileMb(e.target.value)} />
      </div>
      <div className="flex items-center gap-1"><Label className="text-xs">صفحات</Label>
        <Input type="number" className="w-20" value={pages} onChange={(e) => setPages(e.target.value)} />
      </div>
      <div className="flex items-center gap-2"><Switch checked={enabled} onCheckedChange={setEnabled} /><span className="text-xs">مفعل</span></div>
      <Button size="sm" onClick={() => onSave({
        id: row.id,
        feature: row.feature,
        period, limit_count: limit, enabled,
        max_file_mb: fileMb ? Number(fileMb) : null,
        max_pages: pages ? Number(pages) : null,
      })}>حفظ</Button>
    </div>
  );
}

/* ---------------- Per-user overrides ---------------- */

function UsersTab() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<{ user_id: string; name: string; role: string } | null>(null);
  const searchFn = useServerFn(searchUsersForQuota);
  const search = useMutation({
    mutationFn: () => searchFn({ data: { q } }),
    onError: (e: any) => toast.error(e?.message ?? "فشل البحث"),
  });

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="md:col-span-1">
        <CardHeader><CardTitle className="text-base">بحث عن مستخدم</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="اسم الطالب أو المعلم..." value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && q && search.mutate()} />
            <Button size="icon" variant="outline" onClick={() => q && search.mutate()}><Search className="w-4 h-4" /></Button>
          </div>
          <div className="space-y-1 max-h-96 overflow-auto">
            {(search.data ?? []).map((u: any) => (
              <button key={u.user_id} onClick={() => setSelected(u)}
                className={`w-full text-right p-2 rounded text-sm border hover:bg-accent ${selected?.user_id === u.user_id ? "bg-accent" : ""}`}>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted-foreground">{u.sub}</div>
              </button>
            ))}
            {search.data && (search.data as any[]).length === 0 && (
              <p className="text-xs text-muted-foreground">لا نتائج.</p>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="md:col-span-2">
        {selected ? <UserQuotaPanel user={selected} /> : (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">اختر مستخدماً لعرض حصصه.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function UserQuotaPanel({ user }: { user: { user_id: string; name: string; role: string } }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getUserQuotaStatus);
  const overrideFn = useServerFn(upsertUserOverride);
  const resetFn = useServerFn(resetUserQuota);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["user-quota-status", user.user_id],
    queryFn: () => statusFn({ data: { user_id: user.user_id } }),
  });

  const saveMut = useMutation({
    mutationFn: (p: any) => overrideFn({ data: p }),
    onSuccess: () => { toast.success("تم الحفظ"); refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  const resetMut = useMutation({
    mutationFn: (feature?: string) => resetFn({ data: { user_id: user.user_id, feature: feature as any } }),
    onSuccess: () => { toast.success("تم إعادة تعيين الحصة"); refetch(); qc.invalidateQueries({ queryKey: ["user-quota-status"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{user.name}</CardTitle>
            <CardDescription>{user.role === "admin" ? "معلم" : "طالب"}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => resetMut.mutate(undefined)}>
            <RefreshCw className="w-4 h-4 ml-1" /> إعادة تعيين الكل
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? <Skeleton className="h-64" /> : (data?.features ?? []).map((f: any) => (
          <FeatureRow key={f.feature} userId={user.user_id} row={f}
            onSave={(p) => saveMut.mutate(p)}
            onReset={() => resetMut.mutate(f.feature)} />
        ))}
      </CardContent>
    </Card>
  );
}

function FeatureRow({ userId, row, onSave, onReset }: { userId: string; row: any; onSave: (p: any) => void; onReset: () => void }) {
  const [limit, setLimit] = useState<string>(row.limit?.toString() ?? "");
  const [unlimited, setUnlimited] = useState<boolean>(!!row.unlimited);
  const [period, setPeriod] = useState<string>(row.period ?? "daily");

  const percent = row.limit ? Math.min(100, Math.round((row.used / row.limit) * 100)) : 0;

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-medium text-sm">{FEATURE_LABEL[row.feature] ?? row.feature}</div>
        <div className="flex items-center gap-2 text-xs">
          {row.unlimited ? (
            <Badge variant="secondary"><InfinityIcon className="w-3 h-3 ml-1" /> غير محدود</Badge>
          ) : (
            <span className="text-muted-foreground">{row.used} / {row.limit} ({PERIOD_LABEL[row.period]})</span>
          )}
        </div>
      </div>
      {!row.unlimited && <Progress value={percent} className="h-1.5" />}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">يومي</SelectItem>
            <SelectItem value="weekly">أسبوعي</SelectItem>
            <SelectItem value="monthly">شهري</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" placeholder="حد مخصص" className="w-28 h-8" value={limit}
          disabled={unlimited} onChange={(e) => setLimit(e.target.value)} />
        <div className="flex items-center gap-1"><Switch checked={unlimited} onCheckedChange={setUnlimited} /><span className="text-xs">غير محدود</span></div>
        <Button size="sm" onClick={() => onSave({
          user_id: userId, feature: row.feature, period,
          limit_count: limit ? Number(limit) : null, unlimited,
        })}>حفظ</Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          <Trash2 className="w-3 h-3 ml-1" /> صفّر الحصة
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Leaderboard ---------------- */

function LeaderboardTab() {
  const fn = useServerFn(getQuotaLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["quota-leaderboard", 7],
    queryFn: () => fn({ data: { days: 7 } }),
  });
  if (isLoading) return <Skeleton className="h-64" />;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">أكثر المستخدمين استهلاكاً (7 أيام)</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(data?.topUsers ?? []).map((u: any) => (
            <div key={u.user_id} className="flex justify-between text-sm border rounded p-2">
              <span className="font-medium">{u.name}</span>
              <span className="text-muted-foreground">{u.requests} طلب · {u.charged} محسوب · {u.tokens.toLocaleString()} tk</span>
            </div>
          ))}
          {(data?.topUsers ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا بيانات.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">حسب الميزة</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(data?.byFeature ?? []).map((f: any) => (
            <div key={f.feature} className="flex justify-between text-sm border rounded p-2">
              <span className="font-medium">{FEATURE_LABEL[f.feature] ?? f.feature}</span>
              <span className="text-muted-foreground">{f.requests} طلب · {f.tokens.toLocaleString()} tk · ${f.cost.toFixed(4)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
