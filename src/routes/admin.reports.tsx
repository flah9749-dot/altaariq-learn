import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Users, FileText, TrendingUp, Award, Download, FileSpreadsheet,
  Trophy, MessageSquare, Gift, Activity as ActivityIcon, Search, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { exportToExcel, exportToPdf } from "@/lib/reports-lazy";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { Input } from "@/components/ui/input";
import { PointsAdjustDialog } from "@/components/admin/PointsAdjustDialog";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "التقارير — لوحة المدرس" }] }),
  component: ReportsPage,
});

type Period = "all" | "30" | "7";

function sinceIso(period: Period) {
  if (period === "all") return null;
  return new Date(Date.now() - Number(period) * 86400000).toISOString();
}

function ReportsPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [classFilter, setClassFilter] = useState<string>("all");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });

  return (
    <div className="space-y-6">
      <SectionTabs items={[{ to: "/admin/reports", label: "التقارير" }, { to: "/admin/leaderboard", label: "ترتيب الطلاب" }]} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />التقارير والتحليلات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">نظرة شاملة على أداء المنصة والطلاب</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/leaderboard"><Trophy className="h-4 w-4 ml-1"/>ترتيب الطلاب</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفترات</SelectItem>
              <SelectItem value="30">آخر 30 يوم</SelectItem>
              <SelectItem value="7">آخر 7 أيام</SelectItem>
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="الصف" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الصفوف</SelectItem>
              {(classes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="exams" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="exams"><FileText className="h-4 w-4 ml-1"/>الامتحانات</TabsTrigger>
          <TabsTrigger value="students"><Users className="h-4 w-4 ml-1"/>الطلاب</TabsTrigger>
          <TabsTrigger value="messages"><MessageSquare className="h-4 w-4 ml-1"/>الرسائل</TabsTrigger>
          <TabsTrigger value="rewards"><Gift className="h-4 w-4 ml-1"/>الجوائز</TabsTrigger>
          <TabsTrigger value="activity"><ActivityIcon className="h-4 w-4 ml-1"/>النشاط</TabsTrigger>
        </TabsList>

        <TabsContent value="exams"><ExamsReport period={period} classFilter={classFilter} /></TabsContent>
        <TabsContent value="students"><StudentsReport classFilter={classFilter} /></TabsContent>
        <TabsContent value="messages"><MessagesReport period={period} /></TabsContent>
        <TabsContent value="rewards"><RewardsReport period={period} /></TabsContent>
        <TabsContent value="activity"><ActivityReport period={period} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ Exams Report ============ */
function ExamsReport({ period, classFilter }: { period: Period; classFilter: string }) {
  const { data: attempts, isLoading } = useQuery({
    queryKey: ["reports-attempts", period, classFilter],
    queryFn: async () => {
      let q = supabase.from("exam_attempts")
        .select("id,percentage,submitted_at,exam_id,student_id,approved,exams(title),students(full_name,code,class_id)")
        .not("submitted_at", "is", null);
      const since = sinceIso(period);
      if (since) q = q.gte("submitted_at", since);
      const { data } = await q;
      let list = data ?? [];
      if (classFilter !== "all") list = list.filter((a: any) => a.students?.class_id === classFilter);
      return list;
    },
  });

  const stats = useMemo(() => {
    const list = attempts ?? [];
    const pcts = list.map((a: any) => Number(a.percentage) || 0);
    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    const pass = pcts.length ? Math.round((pcts.filter((p) => p >= 50).length / pcts.length) * 100) : 0;
    const buckets = [
      { name: "0-49%", value: pcts.filter((s) => s < 50).length },
      { name: "50-64%", value: pcts.filter((s) => s >= 50 && s < 65).length },
      { name: "65-84%", value: pcts.filter((s) => s >= 65 && s < 85).length },
      { name: "85-100%", value: pcts.filter((s) => s >= 85).length },
    ];
    const byDay = new Map<string, { sum: number; count: number }>();
    list.forEach((a: any) => {
      const d = new Date(a.submitted_at).toISOString().slice(0, 10);
      const cur = byDay.get(d) ?? { sum: 0, count: 0 };
      cur.sum += Number(a.percentage) || 0; cur.count++;
      byDay.set(d, cur);
    });
    const timeline = Array.from(byDay.entries()).sort().map(([d, v]) => ({ date: d.slice(5), avg: Math.round(v.sum / v.count) }));
    const byStudent = new Map<string, { name: string; code: string; sum: number; count: number }>();
    list.forEach((a: any) => {
      const cur = byStudent.get(a.student_id) ?? { name: a.students?.full_name ?? "—", code: a.students?.code ?? "", sum: 0, count: 0 };
      cur.sum += Number(a.percentage) || 0; cur.count++;
      byStudent.set(a.student_id, cur);
    });
    const topStudents = Array.from(byStudent.values())
      .map((s) => ({ ...s, avg: Math.round(s.sum / s.count) }))
      .sort((a, b) => b.avg - a.avg).slice(0, 10);
    return { count: list.length, avg, pass, buckets, timeline, topStudents };
  }, [attempts]);

  const COLORS = ["hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--success))"];

  const rows = stats.topStudents.map((s, i) => ({ "#": i + 1, "الاسم": s.name, "الكود": s.code, "المتوسط": `${s.avg}%`, "عدد الامتحانات": s.count }));
  const doExcel = () => exportToExcel(rows, `تقرير-الامتحانات-${new Date().toISOString().slice(0, 10)}.xlsx`);
  const doPdf = () => exportToPdf({
    title: "تقرير الامتحانات",
    subtitle: `${stats.count} محاولة — متوسط ${stats.avg}% — نجاح ${stats.pass}%`,
    columns: ["#", "الاسم", "الكود", "المتوسط", "عدد الامتحانات"],
    rows: stats.topStudents.map((s, i) => [i + 1, s.name, s.code, `${s.avg}%`, s.count]),
    filename: `تقرير-الامتحانات-${new Date().toISOString().slice(0, 10)}.pdf`,
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={BarChart3} label="محاولات" value={stats.count} />
        <Stat icon={TrendingUp} label="متوسط الدرجات" value={`${stats.avg}%`} color="text-primary" />
        <Stat icon={Award} label="نسبة النجاح" value={`${stats.pass}%`} color="text-success" />
        <div className="flex gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={doExcel}><FileSpreadsheet className="h-4 w-4 ml-1"/>Excel</Button>
          <Button variant="outline" size="sm" onClick={doPdf}><Download className="h-4 w-4 ml-1"/>PDF</Button>
        </div>
      </div>

      {stats.count === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد بيانات</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">توزيع الدرجات</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.buckets} dataKey="value" nameKey="name" outerRadius={80} label>
                      {stats.buckets.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Legend /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">تطور المتوسط اليومي</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
                    <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={3} name="المتوسط" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-primary"/>أفضل 10 طلاب</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>الاسم</TableHead><TableHead>الكود</TableHead>
                  <TableHead>المتوسط</TableHead><TableHead>عدد الامتحانات</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {stats.topStudents.map((s, i) => (
                    <TableRow key={s.code + i}>
                      <TableCell><Badge variant={i < 3 ? "default" : "outline"}>{i + 1}</Badge></TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell><span className="font-bold text-primary">{s.avg}%</span></TableCell>
                      <TableCell>{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ============ Students Report ============ */
function StudentsReport({ classFilter }: { classFilter: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports-students", classFilter],
    queryFn: async () => {
      let q = supabase.from("students").select("id,full_name,code,status,points,level,class_id,classes(name),groups(name)");
      if (classFilter !== "all") q = q.eq("class_id", classFilter);
      const { data } = await q.order("points", { ascending: false });
      return data ?? [];
    },
  });

  const list = data ?? [];
  const active = list.filter((s: any) => s.status === "active").length;
  const suspended = list.filter((s: any) => s.status !== "active").length;
  const totalPts = list.reduce((a: number, s: any) => a + (s.points || 0), 0);

  const rows = list.map((s: any, i: number) => ({
    "#": i + 1, "الاسم": s.full_name, "الكود": s.code, "الصف": s.classes?.name ?? "—",
    "المجموعة": s.groups?.name ?? "—", "الحالة": s.status === "active" ? "نشط" : "موقوف",
    "النقاط": s.points ?? 0, "المستوى": s.level ?? 1,
  }));

  const doExcel = () => exportToExcel(rows, `تقرير-الطلاب-${new Date().toISOString().slice(0, 10)}.xlsx`);
  const doPdf = () => exportToPdf({
    title: "تقرير الطلاب",
    subtitle: `${list.length} طالب — ${active} نشط — ${suspended} موقوف`,
    columns: ["#", "الاسم", "الكود", "الصف", "المجموعة", "الحالة", "النقاط", "المستوى"],
    rows: list.map((s: any, i: number) => [
      i + 1, s.full_name, s.code, s.classes?.name ?? "—", s.groups?.name ?? "—",
      s.status === "active" ? "نشط" : "موقوف", s.points ?? 0, s.level ?? 1,
    ]),
    filename: `تقرير-الطلاب-${new Date().toISOString().slice(0, 10)}.pdf`,
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="إجمالي" value={list.length} />
        <Stat icon={Users} label="نشط" value={active} color="text-success" />
        <Stat icon={Users} label="موقوف" value={suspended} color="text-destructive" />
        <Stat icon={Award} label="إجمالي النقاط" value={totalPts} color="text-primary" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={doExcel}><FileSpreadsheet className="h-4 w-4 ml-1"/>Excel</Button>
        <Button variant="outline" size="sm" onClick={doPdf}><Download className="h-4 w-4 ml-1"/>PDF</Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>الاسم</TableHead><TableHead>الكود</TableHead>
              <TableHead>الصف</TableHead><TableHead>الحالة</TableHead>
              <TableHead>النقاط</TableHead><TableHead>المستوى</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {list.slice(0, 50).map((s: any, i: number) => (
                <TableRow key={s.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="text-xs">{s.classes?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status === "active" ? "نشط" : "موقوف"}</Badge></TableCell>
                  <TableCell className="font-bold text-primary">{s.points ?? 0}</TableCell>
                  <TableCell>{s.level ?? 1}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {list.length > 50 && <p className="p-3 text-center text-xs text-muted-foreground">يعرض أول 50 — استخدم التصدير للحصول على القائمة الكاملة</p>}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ Messages Report ============ */
function MessagesReport({ period }: { period: Period }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports-messages", period],
    queryFn: async () => {
      let q = supabase.from("messages").select("id,body,attachment_url,created_at,sender_id,recipient_id");
      const since = sinceIso(period);
      if (since) q = q.gte("created_at", since);
      return (await q.order("created_at", { ascending: false })).data ?? [];
    },
  });

  const list = data ?? [];
  const withFiles = list.filter((m: any) => m.attachment_url).length;
  const byDay = new Map<string, number>();
  list.forEach((m: any) => {
    const d = new Date(m.created_at).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  });
  const timeline = Array.from(byDay.entries()).sort().map(([d, v]) => ({ date: d.slice(5), count: v }));

  const doExcel = () => exportToExcel(
    list.map((m: any) => ({ "التاريخ": new Date(m.created_at).toLocaleString("ar"), "المحتوى": m.body ?? "(مرفق)", "مرفق": m.attachment_url ? "نعم" : "لا" })),
    `تقرير-الرسائل-${new Date().toISOString().slice(0, 10)}.xlsx`
  );

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={MessageSquare} label="إجمالي الرسائل" value={list.length} />
        <Stat icon={FileText} label="رسائل بمرفقات" value={withFiles} color="text-primary" />
        <div className="flex gap-2 sm:justify-end items-center">
          <Button variant="outline" size="sm" onClick={doExcel}><FileSpreadsheet className="h-4 w-4 ml-1"/>Excel</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">حركة الرسائل اليومية</CardTitle></CardHeader>
        <CardContent className="h-64">
          {timeline.length === 0 ? <p className="text-center text-sm text-muted-foreground">لا توجد بيانات</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis /><Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="رسائل" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ Rewards Report ============ */
function RewardsReport({ period }: { period: Period }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports-rewards", period],
    queryFn: async () => {
      let q = supabase.from("reward_redemptions").select("id,status,points_cost,created_at,reward_catalog(name),students(full_name,code)");
      const since = sinceIso(period);
      if (since) q = q.gte("created_at", since);
      return (await q.order("created_at", { ascending: false })).data ?? [];
    },
  });

  const list = data ?? [];
  const approved = list.filter((r: any) => r.status === "approved" || r.status === "delivered").length;
  const pending = list.filter((r: any) => r.status === "pending").length;
  const totalPts = list.filter((r: any) => r.status !== "rejected").reduce((a: number, r: any) => a + (r.points_cost || 0), 0);

  const doExcel = () => exportToExcel(
    list.map((r: any, i: number) => ({
      "#": i + 1, "الطالب": r.students?.full_name ?? "—", "الكود": r.students?.code ?? "",
      "الجائزة": r.reward_catalog?.name ?? "—", "النقاط": r.points_cost, "الحالة": r.status,
      "التاريخ": new Date(r.created_at).toLocaleString("ar"),
    })),
    `تقرير-الجوائز-${new Date().toISOString().slice(0, 10)}.xlsx`
  );

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Gift} label="الاستبدالات" value={list.length} />
        <Stat icon={Award} label="معتمد/مستلم" value={approved} color="text-success" />
        <Stat icon={Award} label="بانتظار" value={pending} color="text-warning" />
        <Stat icon={TrendingUp} label="نقاط مصروفة" value={totalPts} color="text-primary" />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={doExcel}><FileSpreadsheet className="h-4 w-4 ml-1"/>Excel</Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>الطالب</TableHead><TableHead>الجائزة</TableHead>
              <TableHead>النقاط</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {list.slice(0, 50).map((r: any, i: number) => (
                <TableRow key={r.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.students?.full_name ?? "—"}</TableCell>
                  <TableCell>{r.reward_catalog?.name ?? "—"}</TableCell>
                  <TableCell className="font-bold text-primary">{r.points_cost}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("ar")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ Activity Report ============ */
function ActivityReport({ period }: { period: Period }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports-activity", period],
    queryFn: async () => {
      let q = supabase.from("activity_log").select("id,action,entity_type,created_at,actor_id");
      const since = sinceIso(period);
      if (since) q = q.gte("created_at", since);
      return (await q.order("created_at", { ascending: false }).limit(500)).data ?? [];
    },
  });

  const list = data ?? [];
  const byAction = new Map<string, number>();
  list.forEach((a: any) => byAction.set(a.action, (byAction.get(a.action) ?? 0) + 1));
  const actionData = Array.from(byAction.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

  const doExcel = () => exportToExcel(
    list.map((a: any) => ({ "التاريخ": new Date(a.created_at).toLocaleString("ar"), "العملية": a.action, "الكيان": a.entity_type ?? "—" })),
    `تقرير-النشاط-${new Date().toISOString().slice(0, 10)}.xlsx`
  );

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat icon={ActivityIcon} label="عمليات مسجلة" value={list.length} />
        <div className="flex gap-2 sm:justify-end items-center">
          <Button variant="outline" size="sm" onClick={doExcel}><FileSpreadsheet className="h-4 w-4 ml-1"/>Excel</Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/admin/activity">فتح سجل النشاط الكامل</Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">أكثر العمليات تكرارًا</CardTitle></CardHeader>
        <CardContent className="h-72">
          {actionData.length === 0 ? <p className="text-center text-sm text-muted-foreground">لا توجد بيانات</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} /><Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" name="عدد" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ Shared ============ */
function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color?: string }) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <Icon className={`h-8 w-8 ${color ?? "text-primary"}`} />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}
