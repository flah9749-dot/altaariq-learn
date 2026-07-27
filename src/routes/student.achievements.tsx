import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Medal, Trophy, Lock, Star, Target, MapPin, CheckCircle2, HelpCircle,
  Gift, Award, TrendingUp, TrendingDown, Users, Zap,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/student/achievements")({
  head: () => ({
    meta: [
      { title: "الإنجازات — الطارق التعليمية" },
      { name: "description", content: "لوحة إنجازاتك: الشارات، الميداليات، النقاط، والترتيب." },
      { property: "og:title", content: "الإنجازات — الطارق التعليمية" },
      { property: "og:description", content: "لوحة إنجازاتك: الشارات، الميداليات، النقاط، والترتيب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const { profile } = useAuth();
  const studentId = profile?.id;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["gam-stats", studentId], enabled: !!studentId,
    queryFn: async () => {
      const { data } = await supabase.rpc("student_gamification_stats", { _student_id: studentId! });
      return (data as any) ?? {};
    },
  });

  const { data: badges } = useQuery({ queryKey: ["all-badges"], queryFn: async () => (await supabase.from("badges").select("*").eq("active", true)).data ?? [] });
  const { data: myBadges } = useQuery({
    queryKey: ["my-badges", studentId], enabled: !!studentId,
    queryFn: async () => (await supabase.from("student_badges").select("*").eq("student_id", studentId!)).data ?? [],
  });
  const { data: achs } = useQuery({ queryKey: ["all-achs"], queryFn: async () => (await supabase.from("achievements").select("*").eq("active", true)).data ?? [] });
  const { data: myAchs } = useQuery({
    queryKey: ["my-achs", studentId], enabled: !!studentId,
    queryFn: async () => (await supabase.from("student_achievements").select("*").eq("student_id", studentId!)).data ?? [],
  });
  const { data: myRewards } = useQuery({
    queryKey: ["my-rewards", studentId], enabled: !!studentId,
    queryFn: async () => (await supabase.from("reward_redemptions").select("*, reward_catalog(title,image_url,points_cost)").eq("student_id", studentId!).order("created_at", { ascending: false })).data ?? [],
  });

  const earnedBadgeIds = new Set((myBadges ?? []).map((b: any) => b.badge_id));
  const earnedAchIds = new Set((myAchs ?? []).map((a: any) => a.achievement_id));

  // XP progress
  const pts = stats?.points ?? 0;
  const curMin = stats?.current_level_min ?? 0;
  const nextMin = stats?.next_level_min;
  const xpProgress = nextMin && nextMin > curMin ? Math.round(((pts - curMin) / (nextMin - curMin)) * 100) : 100;

  // Progression trend (last 6)
  const trend = Array.isArray(stats?.last_percents) ? [...stats.last_percents].reverse() : [];
  const trendData = trend.map((v: number, i: number) => ({ i: i + 1, pct: Number(v) }));
  const lastTwo = trend.slice(-2);
  const diff = lastTwo.length === 2 ? Math.round(lastTwo[1] - lastTwo[0]) : null;

  // Rank & compare
  const rank = stats?.class_rank ?? 0;
  const size = stats?.class_size ?? 0;
  const percentile = size > 0 && rank > 0 ? Math.round(((size - rank + 1) / size) * 100) : null;

  if (statsLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      {/* Player Card */}
      <Card className="overflow-hidden border-2 border-gold/40 bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-4 border-gold shadow-xl">
              <AvatarImage src={stats?.avatar_url ?? undefined} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{(stats?.full_name ?? "؟").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs opacity-80">اللاعب</p>
              <h1 className="text-2xl md:text-3xl font-bold truncate">{stats?.full_name ?? "—"}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-gold text-primary font-bold">
                  <Star className="h-3 w-3 ml-1 fill-current" />المستوى {stats?.level ?? 1}
                </Badge>
                <Badge variant="outline" className="border-white/40 text-white bg-white/10">
                  <Zap className="h-3 w-3 ml-1" />{pts} XP
                </Badge>
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span>تقدّم المستوى{nextMin ? ` (${nextMin - pts} XP للمستوى التالي${stats?.next_level_name ? `: ${stats.next_level_name}` : ""})` : ""}</span>
              <span className="tabular-nums">{xpProgress}%</span>
            </div>
            <Progress value={xpProgress} className="h-3 bg-white/20" />
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Target} label="الامتحانات" value={stats?.exam_count ?? 0} color="text-primary" />
        <StatTile icon={HelpCircle} label="الأسئلة" value={stats?.answers_total ?? 0} color="text-accent" />
        <StatTile icon={CheckCircle2} label="إجابات صحيحة" value={stats?.answers_correct ?? 0} color="text-success" />
        <StatTile icon={MapPin} label="الخرائط" value={stats?.map_answers ?? 0} color="text-gold" />
        <StatTile icon={TrendingUp} label="الترتيب في الصف" value={rank ? `${rank}/${size}` : "—"} color="text-primary" />
        <StatTile icon={Gift} label="الجوائز" value={stats?.rewards ?? 0} color="text-destructive" />
        <StatTile icon={Medal} label="الميداليات" value={stats?.badges ?? 0} color="text-gold" />
        <StatTile icon={Zap} label="XP" value={pts} color="text-warning-foreground" />
      </div>

      {/* Compare vs peers */}
      {percentile != null && (
        <Card className="border-gold/30 bg-gold/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gold/20 flex items-center justify-center">
              <Users className="h-7 w-7 text-gold" />
            </div>
            <div className="flex-1">
              <p className="text-sm">أنت في المركز <b>{rank}</b> من أصل <b>{size}</b> طالب</p>
              <p className="text-sm text-muted-foreground">أفضل من <b className="text-success">{percentile}%</b> من زملائك في نفس الصف.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compare vs self */}
      {trendData.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />مقارنة أدائك
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div><p className="text-xs text-muted-foreground">الامتحان السابق</p><p className="text-2xl font-bold">{Math.round(lastTwo[0])}%</p></div>
              <div><p className="text-xs text-muted-foreground">الحالي</p><p className="text-2xl font-bold text-primary">{Math.round(lastTwo[1])}%</p></div>
              {diff != null && (
                <div>
                  <p className="text-xs text-muted-foreground">التغير</p>
                  <p className={`text-2xl font-bold flex items-center gap-1 ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                    {diff >= 0 ? <TrendingUp className="h-5 w-5"/> : <TrendingDown className="h-5 w-5"/>}
                    {diff >= 0 ? "+" : ""}{diff}%
                  </p>
                </div>
              )}
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <XAxis dataKey="i" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip formatter={(v: any) => `${Math.round(Number(v))}%`} />
                  <Line type="monotone" dataKey="pct" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Badges / Achievements / Rewards */}
      <Tabs defaultValue="badges">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="badges"><Medal className="h-4 w-4 ml-1"/>الشارات ({earnedBadgeIds.size}/{badges?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="achievements"><Trophy className="h-4 w-4 ml-1"/>الإنجازات ({earnedAchIds.size}/{achs?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="rewards"><Gift className="h-4 w-4 ml-1"/>الجوائز ({myRewards?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="mt-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {(badges ?? []).map((b: any) => {
              const earned = earnedBadgeIds.has(b.id);
              return (
                <Card key={b.id} className={earned ? "border-gold/40" : "opacity-50"}>
                  <CardContent className="p-4 text-center space-y-2">
                    <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center text-white shadow-lg" style={{ background: earned ? (b.color || "#d4af37") : "#94a3b8" }}>
                      {earned ? <Medal className="h-8 w-8"/> : <Lock className="h-6 w-6"/>}
                    </div>
                    <p className="font-bold text-sm">{b.name}</p>
                    {b.description && <p className="text-xs text-muted-foreground">{b.description}</p>}
                  </CardContent>
                </Card>
              );
            })}
            {(!badges || badges.length === 0) && <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">لا توجد شارات بعد</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(achs ?? []).map((a: any) => {
              const earned = earnedAchIds.has(a.id);
              return (
                <Card key={a.id} className={earned ? "border-success" : ""}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${earned ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                      {earned ? <Trophy className="h-6 w-6"/> : <Lock className="h-5 w-5"/>}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                    {earned && <Badge className="bg-success text-success-foreground">مُنجَز</Badge>}
                  </CardContent>
                </Card>
              );
            })}
            {(!achs || achs.length === 0) && <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">لا توجد إنجازات بعد</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="rewards" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(myRewards ?? []).map((r: any) => (
              <Card key={r.id} className="border-gold/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-gold/10 flex items-center justify-center overflow-hidden">
                    {r.reward_catalog?.image_url
                      ? <img src={r.reward_catalog.image_url} alt="" className="h-full w-full object-cover"/>
                      : <Award className="h-7 w-7 text-gold"/>}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{r.reward_catalog?.title ?? "جائزة"}</p>
                    <p className="text-xs text-muted-foreground">-{r.points_spent} نقطة</p>
                  </div>
                  <Badge variant={r.status === "delivered" ? "default" : r.status === "approved" ? "outline" : "secondary"}>
                    {r.status === "delivered" ? "مُسلَّمة" : r.status === "approved" ? "مقبولة" : r.status === "rejected" ? "مرفوضة" : "قيد المراجعة"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {(!myRewards || myRewards.length === 0) && <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">لم تستبدل جوائز بعد</CardContent></Card>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }: any) {
  return (
    <Card><CardContent className="p-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </CardContent></Card>
  );
}
