import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, FileText, TrendingUp, Award, Download, FileSpreadsheet, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToExcel, exportToPdf } from "@/lib/reports";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "التقارير — لوحة المدرس" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [period, setPeriod] = useState<"all" | "30" | "7">("all");
  const [classFilter, setClassFilter] = useState<string>("all");

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [] });

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["reports-attempts", period, classFilter],
    queryFn: async () => {
      let q = supabase.from("exam_attempts")
        .select("id,percentage,score,total,approved,submitted_at,exam_id,student_id,exams(title,class_id),students(full_name,code,class_id,classes(name))")
        .not("submitted_at", "is", null);
      if (period !== "all") {
        const since = new Date(Date.now() - Number(period) * 24 * 3600 * 1000).toISOString();
        q = q.gte("submitted_at", since);
      }
      const { data } = await q;
      let list = data ?? [];
      if (classFilter !== "all") list = list.filter((a: any) => a.students?.class_id === classFilter);
      return list;
    },
  });

  const { data: studentsCount } = useQuery({
    queryKey: ["stu-count"], queryFn: async () => (await supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active")).count ?? 0,
  });
  const { data: examsCount } = useQuery({
    queryKey: ["exam-count"], queryFn: async () => (await supabase.from("exams").select("id", { count: "exact", head: true })).count ?? 0,
  });

  const stats = useMemo(() => {
    const list = attempts ?? [];
    const pcts = list.map((a: any) => Number(a.percentage) || 0);
    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    const pass = pcts.length ? Math.round((pcts.filter((p) => p >= 50).length / pcts.length) * 100) : 0;
    const approvedCount = list.filter((a: any) => a.approved).length;

    // Buckets
    const buckets = [
      { name: "0-49%", value: pcts.filter((s) => s < 50).length },
      { name: "50-64%", value: pcts.filter((s) => s >= 50 && s < 65).length },
      { name: "65-84%", value: pcts.filter((s) => s >= 65 && s < 85).length },
      { name: "85-100%", value: pcts.filter((s) => s >= 85).length },
    ];

    // Per-exam averages
    const byExam = new Map<string, { title: string; sum: number; count: number }>();
    list.forEach((a: any) => {
      const key = a.exam_id;
      const cur = byExam.get(key) ?? { title: a.exams?.title ?? "—", sum: 0, count: 0 };
      cur.sum += Number(a.percentage) || 0; cur.count++;
      byExam.set(key, cur);
    });
    const examAvgs = Array.from(byExam.values()).map((e) => ({ name: e.title.slice(0, 25), avg: Math.round(e.sum / e.count) }));

    // Timeline per day
    const byDay = new Map<string, { sum: number; count: number }>();
    list.forEach((a: any) => {
      const d = new Date(a.submitted_at).toISOString().slice(0, 10);
      const cur = byDay.get(d) ?? { sum: 0, count: 0 };
      cur.sum += Number(a.percentage) || 0; cur.count++;
      byDay.set(d, cur);
    });
    const timeline = Array.from(byDay.entries()).sort().map(([d, v]) => ({ date: d.slice(5), avg: Math.round(v.sum / v.count) }));

    // Top students
    const byStudent = new Map<string, { name: string; code: string; sum: number; count: number }>();
    list.forEach((a: any) => {
      const key = a.student_id;
      const cur = byStudent.get(key) ?? { name: a.students?.full_name ?? "—", code: a.students?.code ?? "", sum: 0, count: 0 };
      cur.sum += Number(a.percentage) || 0; cur.count++;
      byStudent.set(key, cur);
    });
    const topStudents = Array.from(byStudent.values())
      .map((s) => ({ ...s, avg: Math.round(s.sum / s.count) }))
      .sort((a, b) => b.avg - a.avg).slice(0, 10);

    return { count: list.length, avg, pass, approvedCount, buckets, examAvgs, timeline, topStudents };
  }, [attempts]);

  const COLORS = ["hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--success))"];

  const doExcel = () => exportToExcel(stats.topStudents.map((s, i) => ({
    "#": i + 1, "الاسم": s.name, "الكود": s.code, "المتوسط": `${s.avg}%`, "عدد الامتحانات": s.count,
  })), `تقرير-عام-${new Date().toISOString().slice(0, 10)}.xlsx`);

  const doPdf = () => exportToPdf({
    title: "التقرير العام لأداء الطلاب",
    subtitle: `${stats.count} محاولة — متوسط ${stats.avg}% — نجاح ${stats.pass}%`,
    columns: ["#", "الاسم", "الكود", "المتوسط", "عدد الامتحانات"],
    rows: stats.topStudents.map((s, i) => [i + 1, s.name, s.code, `${s.avg}%`, s.count]),
    filename: `تقرير-عام-${new Date().toISOString().slice(0, 10)}.pdf`,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />التقارير والتحليلات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">نظرة شاملة على أداء المنصة والطلاب</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={doExcel}><FileSpreadsheet className="h-4 w-4 ml-1"/>Excel</Button>
          <Button variant="outline" size="sm" onClick={doPdf}><Download className="h-4 w-4 ml-1"/>PDF</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
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
          <Button asChild variant="secondary" size="sm" className="mr-auto">
            <Link to="/admin/leaderboard"><Trophy className="h-4 w-4 ml-1"/>ترتيب الطلاب</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={Users} label="الطلاب" value={studentsCount ?? 0} />
        <Stat icon={FileText} label="الامتحانات" value={examsCount ?? 0} />
        <Stat icon={BarChart3} label="محاولات" value={stats.count} />
        <Stat icon={TrendingUp} label="متوسط الدرجات" value={`${stats.avg}%`} color="text-primary" />
        <Stat icon={Award} label="نسبة النجاح" value={`${stats.pass}%`} color="text-success" />
      </div>

      {isLoading ? <Skeleton className="h-64" /> : stats.count === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد بيانات في الفترة المحددة</CardContent></Card>
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
            <CardHeader><CardTitle className="text-base">متوسط الدرجات لكل امتحان</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.examAvgs}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip />
                  <Bar dataKey="avg" fill="hsl(var(--primary))" name="المتوسط %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-gold"/>أفضل 10 طلاب</CardTitle></CardHeader>
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

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color?: string }) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <Icon className={`h-8 w-8 ${color ?? "text-primary"}`} />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}
