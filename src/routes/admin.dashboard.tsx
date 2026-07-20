import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, Trophy, MessageSquare, Bell, GraduationCap, Bot, Award, TrendingUp, Activity, Sparkles, CheckCircle2, XCircle, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "الرئيسية — لوحة المدرس" }] }),
  component: AdminDashboard,
});

async function fetchDashboard() {
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();
  const sinceToday = new Date(); sinceToday.setHours(0, 0, 0, 0);
  const todayISO = sinceToday.toISOString();

  const [
    stuTotal, stuActive, stuSuspended, lastStudents,
    examTotal, examPub, attemptsAll, attempts7,
    msgToday, msgUnread,
    rewardTotal, redemptions, pointsGranted,
    notifCount,
    topStudents,
    aiTotal, aiSuccess, aiByProvider, aiLast,
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "suspended"),
    supabase.from("students").select("id,full_name,code,created_at,avatar_url").order("created_at", { ascending: false }).limit(5),
    supabase.from("exams").select("id", { count: "exact", head: true }),
    supabase.from("exams").select("id", { count: "exact", head: true }).eq("published", true),
    supabase.from("exam_attempts").select("percentage,exam_id,exams(title)").not("submitted_at", "is", null),
    supabase.from("exam_attempts").select("submitted_at,percentage").not("submitted_at", "is", null).gte("submitted_at", since7),
    supabase.from("messages").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
    supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("rewards").select("id", { count: "exact", head: true }),
    supabase.from("reward_redemptions").select("id,cost_points").not("id", "is", null),
    supabase.from("points_log").select("points"),
    supabase.from("notifications").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id,full_name,code,points,avatar_url").order("points", { ascending: false }).limit(5),
    supabase.from("ai_usage_logs").select("id", { count: "exact", head: true }),
    supabase.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("success", true),
    supabase.from("ai_usage_logs").select("provider_id,ai_providers(name)"),
    supabase.from("ai_usage_logs").select("created_at,function_name,success,ai_providers(name)").order("created_at", { ascending: false }).limit(5),
  ]);

  const pcts = (attemptsAll.data ?? []).map((a: any) => Number(a.percentage) || 0);
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  const pass = pcts.length ? Math.round((pcts.filter((p) => p >= 50).length / pcts.length) * 100) : 0;

  // Most attempted exam
  const byExam = new Map<string, { title: string; n: number }>();
  (attemptsAll.data ?? []).forEach((a: any) => {
    const cur = byExam.get(a.exam_id) ?? { title: a.exams?.title ?? "—", n: 0 };
    cur.n++; byExam.set(a.exam_id, cur);
  });
  const topExam = Array.from(byExam.values()).sort((a, b) => b.n - a.n)[0];

  // Activity last 7 days
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400_000);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("ar-EG", { weekday: "short" }) };
  });
  const attMap = new Map<string, number>();
  (attempts7.data ?? []).forEach((a: any) => {
    const k = new Date(a.submitted_at).toISOString().slice(0, 10);
    attMap.set(k, (attMap.get(k) ?? 0) + 1);
  });
  const timeline = days.map((d) => ({ day: d.label, attempts: attMap.get(d.key) ?? 0 }));

  // Points granted total
  const pointsTotal = (pointsGranted.data ?? []).reduce((s: number, r: any) => s + Math.max(0, r.points), 0);
  const redemptionsCount = (redemptions.data ?? []).length;

  // AI by provider
  const provMap = new Map<string, number>();
  (aiByProvider.data ?? []).forEach((r: any) => {
    const n = r.ai_providers?.name ?? "غير معروف";
    provMap.set(n, (provMap.get(n) ?? 0) + 1);
  });
  const aiChart = Array.from(provMap.entries()).map(([name, value]) => ({ name, value }));

  return {
    stu: {
      total: stuTotal.count ?? 0,
      active: stuActive.count ?? 0,
      suspended: stuSuspended.count ?? 0,
      last: lastStudents.data ?? [],
      top: topStudents.data ?? [],
    },
    exams: { total: examTotal.count ?? 0, published: examPub.count ?? 0, attempts: pcts.length, avg, pass, topExam },
    msgs: { today: msgToday.count ?? 0, unread: msgUnread.count ?? 0 },
    rewards: { total: rewardTotal.count ?? 0, redemptions: redemptionsCount, pointsTotal },
    notifs: notifCount.count ?? 0,
    timeline,
    ai: {
      total: aiTotal.count ?? 0,
      success: aiSuccess.count ?? 0,
      chart: aiChart,
      last: aiLast.data ?? [],
    },
  };
}

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--gold))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

function AdminDashboard() {
  const { data: d, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: fetchDashboard, refetchInterval: 30000 });

  if (isLoading || !d) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const aiSuccessRate = d.ai.total ? Math.round((d.ai.success / d.ai.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">لوحة تحكم المدرس</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة شاملة على المنصة والنشاط الحالي — يتحدث كل 30 ثانية</p>
      </div>

      {/* Students */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4"/> الطلاب</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="إجمالي الطلاب" value={d.stu.total} icon={Users} accent="primary" />
          <StatCard title="نشطون" value={d.stu.active} icon={CheckCircle2} accent="success" />
          <StatCard title="موقوفون" value={d.stu.suspended} icon={XCircle} accent="destructive" />
          <StatCard title="أعلى نقاطًا" value={d.stu.top[0]?.points ?? 0} icon={Trophy} accent="gold" hint={d.stu.top[0]?.full_name ?? "—"} />
        </div>
      </section>

      {/* Exams */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4"/> الامتحانات</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="الامتحانات" value={d.exams.total} icon={FileText} accent="primary" hint={`${d.exams.published} منشور`} />
          <StatCard title="المحاولات" value={d.exams.attempts} icon={Activity} accent="accent" />
          <StatCard title="متوسط الدرجات" value={`${d.exams.avg}%`} icon={TrendingUp} accent="gold" />
          <StatCard title="نسبة النجاح" value={`${d.exams.pass}%`} icon={Award} accent="success" />
          <StatCard title="الأكثر حلاً" value={d.exams.topExam?.n ?? 0} icon={Trophy} accent="warning" hint={d.exams.topExam?.title ?? "—"} />
        </div>
      </section>

      {/* Messages + Rewards + AI */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="رسائل اليوم" value={d.msgs.today} icon={MessageSquare} accent="primary" hint={`${d.msgs.unread} غير مقروءة`} />
        <StatCard title="الجوائز" value={d.rewards.total} icon={Trophy} accent="gold" hint={`${d.rewards.redemptions} استبدال`} />
        <StatCard title="النقاط الممنوحة" value={d.rewards.pointsTotal} icon={Sparkles} accent="accent" />
        <StatCard title="الإشعارات" value={d.notifs} icon={Bell} accent="warning" />
      </section>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/>محاولات آخر 7 أيام</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip />
                <Line type="monotone" dataKey="attempts" stroke="hsl(var(--primary))" strokeWidth={3} name="عدد المحاولات" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-gold"/>أعلى الطلاب نقاطًا</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.stu.top.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">لا يوجد طلاب بعد</p> :
              d.stu.top.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center gap-3">
                  <Badge variant={i < 3 ? "default" : "outline"} className="w-7 h-7 justify-center p-0">{i + 1}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                  </div>
                  <span className="text-sm font-bold text-primary tabular-nums">{s.points ?? 0}</span>
                </div>
              ))}
            <Button asChild variant="ghost" size="sm" className="w-full"><Link to="/admin/leaderboard">عرض الترتيب الكامل</Link></Button>
          </CardContent>
        </Card>
      </div>

      {/* AI Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bot className="h-5 w-5 text-accent"/>نظرة على الذكاء الاصطناعي</CardTitle>
          <CardDescription>إحصائيات الاستخدام حسب المزود</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="إجمالي الطلبات" value={d.ai.total} />
            <MiniStat label="ناجحة" value={d.ai.success} color="text-success" />
            <MiniStat label="فاشلة" value={d.ai.total - d.ai.success} color="text-destructive" />
            <div className="col-span-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">نسبة النجاح</span>
                <span className="font-bold">{aiSuccessRate}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success transition-all" style={{ width: `${aiSuccessRate}%` }} />
              </div>
            </div>
            <div className="col-span-3 mt-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Clock className="h-3 w-3"/>آخر الطلبات</p>
              <div className="space-y-1">
                {d.ai.last.length === 0 ? <p className="text-xs text-muted-foreground">لا يوجد نشاط</p> :
                  d.ai.last.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b py-1">
                      <span className="flex items-center gap-1">
                        {r.success ? <CheckCircle2 className="h-3 w-3 text-success"/> : <XCircle className="h-3 w-3 text-destructive"/>}
                        {r.function_name}
                      </span>
                      <span className="text-muted-foreground">{r.ai_providers?.name ?? "—"}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <div className="h-64">
            {d.ai.chart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات كافية</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.ai.chart} dataKey="value" nameKey="name" outerRadius={80} label>
                    {d.ai.chart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend /><Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Students */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/>آخر الطلاب المسجلين</CardTitle>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/admin/students">عرض الكل</Link></Button>
        </CardHeader>
        <CardContent>
          {d.stu.last.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا يوجد طلاب مسجلين بعد</p>
          ) : (
            <div className="divide-y">
              {d.stu.last.map((s: any) => (
                <Link key={s.id} to="/admin/students/$id" params={{ id: s.id }} className="flex items-center gap-3 py-2 hover:bg-muted/50 rounded px-2 -mx-2 transition">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {s.full_name?.slice(0, 1) ?? "؟"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("ar-EG")}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, color = "text-primary" }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
