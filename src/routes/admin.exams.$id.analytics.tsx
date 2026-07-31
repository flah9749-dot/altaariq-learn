import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, AlertTriangle, TrendingUp, CheckCircle2, XCircle, MapPin, Sparkles } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/admin/exams/$id/analytics")({
  head: () => ({
    meta: [
      { title: "تحليل الامتحان — الطارق التعليمية" },
      { name: "description", content: "تحليل ذكي لأداء الطلاب على أسئلة الامتحان — تصنيف الأسئلة الصعبة والسهلة." },
      { property: "og:title", content: "تحليل الامتحان — الطارق التعليمية" },
      { property: "og:description", content: "تحليل ذكي لأداء الطلاب على أسئلة الامتحان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamAnalyticsPage,
});

const DIFF_LABEL: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب", unknown: "غير مصنف" };
const DIFF_COLOR: Record<string, string> = {
  easy: "bg-success/10 text-success border-success/30",
  medium: "bg-warning/10 text-warning-foreground border-warning/30",
  hard: "bg-destructive/10 text-destructive border-destructive/30",
  unknown: "bg-muted text-muted-foreground",
};

function ExamAnalyticsPage() {
  const { id } = Route.useParams();

  const { data: exam } = useQuery({
    queryKey: ["exam-a", id],
    queryFn: async () => (await supabase.from("exams").select("id,title,classes(name)").eq("id", id).maybeSingle()).data,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["exam-analytics", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("exam_question_analytics", { _exam_id: id });
      return (data as any) ?? { questions: [] };
    },
  });

  const questions: any[] = data?.questions ?? [];

  const stats = useMemo(() => {
    const answered = questions.filter((q) => q.attempts_count > 0);
    const easy = answered.filter((q) => q.auto_difficulty === "easy").length;
    const medium = answered.filter((q) => q.auto_difficulty === "medium").length;
    const hard = answered.filter((q) => q.auto_difficulty === "hard").length;
    const problematic = answered.filter((q) => q.correct_rate != null && q.correct_rate < 40);
    const mapQs = answered.filter((q) => q.type === "map");
    const mapAvg = mapQs.length ? Math.round(mapQs.reduce((s, q) => s + (q.correct_rate ?? 0), 0) / mapQs.length) : null;

    // Units = manual difficulty groups
    const units = new Map<string, { total: number; sum: number; count: number }>();
    answered.forEach((q) => {
      const key = q.difficulty || "غير مصنف";
      const u = units.get(key) ?? { total: 0, sum: 0, count: 0 };
      u.total++;
      if (q.correct_rate != null) { u.sum += q.correct_rate; u.count++; }
      units.set(key, u);
    });
    const unitList = Array.from(units.entries()).map(([name, u]) => ({
      name,
      count: u.total,
      avg: u.count ? Math.round(u.sum / u.count) : 0,
      verdict: u.count ? (u.sum / u.count >= 70 ? "سهلة" : u.sum / u.count >= 45 ? "متوسطة" : "صعبة") : "—",
    }));

    return { easy, medium, hard, problematic, mapQs, mapAvg, unitList, answered };
  }, [questions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/exams/$id/results" params={{ id }} search={{ attempt: undefined }}>
            <ArrowRight className="h-4 w-4 ml-1" />رجوع للنتائج
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> تحليل ذكي: {exam?.title ?? "..."}
          </h1>
          <p className="text-sm text-muted-foreground">{(exam as any)?.classes?.name ?? ""}</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : stats.answered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد إجابات بعد لتحليل هذا الامتحان.</CardContent></Card>
      ) : (
        <>
          {/* Summary */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="أسئلة سهلة" value={stats.easy} icon={CheckCircle2} color="text-success" />
            <SummaryTile label="أسئلة متوسطة" value={stats.medium} icon={TrendingUp} color="text-warning-foreground" />
            <SummaryTile label="أسئلة صعبة" value={stats.hard} icon={XCircle} color="text-destructive" />
            <SummaryTile label="مشاكل شائعة" value={stats.problematic.length} icon={AlertTriangle} color="text-destructive" />
          </div>

          {/* Units */}
          {stats.unitList.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">تحليل الوحدات</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {stats.unitList.map((u) => (
                  <div key={u.name} className="flex items-center gap-3">
                    <div className="min-w-[8rem] font-semibold text-sm">الوحدة: {u.name}</div>
                    <div className="flex-1"><Progress value={u.avg} /></div>
                    <div className="text-sm w-20 text-left tabular-nums">{u.avg}%</div>
                    <Badge variant="outline" className={
                      u.verdict === "سهلة" ? "border-success/30 text-success" :
                      u.verdict === "متوسطة" ? "border-warning/30" : "border-destructive/30 text-destructive"
                    }>{u.verdict}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Map card */}
          {stats.mapQs.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> أسئلة الخرائط</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">
                  متوسط نسبة الصواب على أسئلة الخرائط: <span className="font-bold">{stats.mapAvg}%</span>
                  {" — "}
                  {stats.mapAvg != null && stats.mapAvg < 50
                    ? <span className="text-destructive">مشكلة عند معظم الطلاب — يُنصح بمراجعة الوحدة الجغرافية.</span>
                    : <span className="text-success">أداء جيّد.</span>}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Bar chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">نسبة الصواب لكل سؤال</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.answered.map((q, i) => ({ name: `س${i + 1}`, pct: q.correct_rate ?? 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="pct" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Per-question list */}
          <Card>
            <CardHeader><CardTitle className="text-base">تحليل كل سؤال</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {questions.map((q, i) => {
                const isProblem = q.correct_rate != null && q.correct_rate < 40;
                return (
                  <div key={q.id} className={`border rounded-lg p-3 ${isProblem ? "border-destructive/40 bg-destructive/5" : ""}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{i + 1}</Badge>
                      <Badge className={DIFF_COLOR[q.auto_difficulty]} variant="outline">{DIFF_LABEL[q.auto_difficulty]}</Badge>
                      {isProblem && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> {q.wrong_count} من {q.attempts_count} طلاب أخطأوا
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground mr-auto">
                        {q.correct_rate != null ? `${q.correct_rate}% صواب` : "لا إجابات"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">{q.text}</p>
                    {q.attempts_count > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span>{q.correct_count} صحيح</span>
                        <XCircle className="h-3.5 w-3.5 text-destructive mr-2" />
                        <span>{q.wrong_count} خطأ</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, icon: Icon, color }: any) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <Icon className={`h-8 w-8 ${color}`} />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}
