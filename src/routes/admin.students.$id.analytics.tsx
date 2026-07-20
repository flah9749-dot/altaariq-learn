import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, TrendingUp, Award, TrendingDown, CheckCircle2, XCircle, Target, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QUESTION_TYPES } from "@/lib/exam-utils";
import { exportToExcel } from "@/lib/reports";
import { formatArabicDateTime } from "@/lib/students-utils";

export const Route = createFileRoute("/admin/students/$id/analytics")({
  head: () => ({ meta: [{ title: "تحليل أداء الطالب" }] }),
  component: StudentAnalyticsPage,
});

function StudentAnalyticsPage() {
  const { id } = Route.useParams();

  const { data: student } = useQuery({
    queryKey: ["stu-a", id],
    queryFn: async () => (await supabase.from("students").select("*, classes(name), groups(name)").eq("id", id).maybeSingle()).data,
  });
  const { data: attempts } = useQuery({
    queryKey: ["stu-attempts", id],
    queryFn: async () => (await supabase.from("exam_attempts")
      .select("*, exams(title)").eq("student_id", id).eq("approved", true).order("submitted_at", { ascending: true })).data ?? [],
  });
  const { data: answers } = useQuery({
    queryKey: ["stu-answers", id], enabled: !!attempts?.length,
    queryFn: async () => {
      const ids = (attempts ?? []).map((a: any) => a.id);
      if (!ids.length) return [];
      return (await supabase.from("attempt_answers").select("is_correct,questions(type)").in("attempt_id", ids)).data ?? [];
    },
  });

  const stats = useMemo(() => {
    const list = attempts ?? [];
    const percentages = list.map((a: any) => Number(a.percentage));
    const avg = percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
    const best = list.length ? list.reduce((a: any, b: any) => Number(a.percentage) > Number(b.percentage) ? a : b) : null;
    const worst = list.length ? list.reduce((a: any, b: any) => Number(a.percentage) < Number(b.percentage) ? a : b) : null;
    const passRate = percentages.length ? Math.round((percentages.filter((p) => p >= 50).length / percentages.length) * 100) : 0;
    const timeline = list.map((a: any) => ({ name: (a.exams?.title ?? "").slice(0, 20), pct: Number(a.percentage) }));
    return { avg, best, worst, passRate, timeline, count: list.length };
  }, [attempts]);

  const typeStats = useMemo(() => {
    const map = new Map<string, { correct: number; wrong: number }>();
    QUESTION_TYPES.forEach((t) => map.set(t.value, { correct: 0, wrong: 0 }));
    (answers ?? []).forEach((a: any) => {
      const t = a.questions?.type; if (!t) return;
      const s = map.get(t) ?? { correct: 0, wrong: 0 };
      if (a.is_correct === true) s.correct++;
      else if (a.is_correct === false) s.wrong++;
      map.set(t, s);
    });
    return Array.from(map.entries()).map(([type, s]) => ({
      type, label: QUESTION_TYPES.find((q) => q.value === type)?.label ?? type,
      correct: s.correct, wrong: s.wrong,
      rate: s.correct + s.wrong > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0,
    })).filter((r) => r.correct + r.wrong > 0);
  }, [answers]);

  const bestType = [...typeStats].sort((a, b) => b.rate - a.rate)[0];
  const worstType = [...typeStats].sort((a, b) => a.rate - b.rate)[0];

  const doExport = () => {
    if (!attempts?.length) return;
    exportToExcel(attempts.map((a: any) => ({
      "الامتحان": a.exams?.title, "الدرجة": a.score, "من": a.total, "النسبة": `${a.percentage}%`,
      "التقدير": a.grade, "تاريخ الحل": formatArabicDateTime(a.submitted_at),
    })), `تقرير-${student?.full_name ?? "طالب"}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/students/$id" params={{ id }}><ArrowRight className="h-4 w-4 ml-1" />ملف الطالب</Link>
        </Button>
        <div className="mr-auto">
          <Button onClick={doExport} variant="outline"><Download className="h-4 w-4 ml-1" />تصدير</Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">تحليل أداء: {student?.full_name}</h1>
        <p className="text-sm text-muted-foreground">{student?.classes?.name} · {student?.groups?.name}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={TrendingUp} label="متوسط الدرجات" value={`${stats.avg}%`} />
        <Stat icon={Award} label="نسبة النجاح" value={`${stats.passRate}%`} color="text-success" />
        <Stat icon={CheckCircle2} label="أفضل امتحان" value={stats.best ? `${stats.best.percentage}%` : "—"} sub={stats.best?.exams?.title} color="text-gold" />
        <Stat icon={TrendingDown} label="أضعف امتحان" value={stats.worst ? `${stats.worst.percentage}%` : "—"} sub={stats.worst?.exams?.title} color="text-destructive" />
      </div>

      {stats.count > 0 ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">تطور الأداء</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pct" stroke="hsl(var(--primary))" strokeWidth={3} name="النسبة" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">أداء أنواع الأسئلة</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="correct" fill="hsl(var(--success))" name="صحيح" />
                    <Bar dataKey="wrong" fill="hsl(var(--destructive))" name="خطأ" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {bestType && <Card className="border-success/30">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-success"/>الأقوى فيه</CardTitle></CardHeader>
                <CardContent><p className="font-bold">{bestType.label}</p><p className="text-xs text-muted-foreground">نسبة الصواب: {bestType.rate}%</p></CardContent>
              </Card>}
              {worstType && <Card className="border-destructive/30">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive"/>يحتاج تحسين في</CardTitle></CardHeader>
                <CardContent><p className="font-bold">{worstType.label}</p><p className="text-xs text-muted-foreground">نسبة الصواب: {worstType.rate}%</p></CardContent>
              </Card>}
            </div>
          </div>
        </>
      ) : (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا يوجد امتحانات معتمدة لتحليلها بعد</CardContent></Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: any; sub?: string; color?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-8 w-8 ${color ?? "text-primary"}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground truncate max-w-[10rem]">{sub}</p>}
        </div>
      </div>
    </CardContent></Card>
  );
}
