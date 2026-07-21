import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Trophy, Star, Award, Bell, TrendingUp, MessageSquare, FolderOpen, Sparkles, ChevronLeft, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { AvatarUploader } from "@/components/common/AvatarUploader";

export const Route = createFileRoute("/student/dashboard")({
  head: () => ({ meta: [{ title: "الرئيسية — لوحة الطالب" }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { profile, refresh } = useAuth();
  const studentId = profile?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["student-dash", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const [me, rewards, notif, ann] = await Promise.all([
        supabase.from("students").select("points, level, parent_whatsapp, parent_phone, parent_name").eq("id", studentId!).maybeSingle(),
        supabase.from("rewards").select("id", { count: "exact", head: true }).eq("student_id", studentId!),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile ? profile.id : "").eq("read", false),
        supabase.from("announcements").select("*").eq("published", true).order("created_at", { ascending: false }).limit(5),
      ]);
      return { me: me.data, rewardsCount: rewards.count ?? 0, unread: notif.count ?? 0, announcements: ann.data ?? [] };
    },
  });

  // Live-fetch teacher WhatsApp from settings so updates propagate to parent contact button.
  const { data: teacherWa } = useQuery({
    queryKey: ["setting", "teacher.whatsapp"],
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "teacher.whatsapp").maybeSingle();
      const v = data?.value as any;
      return (typeof v === "string" ? v : v?.toString?.()) ?? "";
    },
  });


  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24"/>
        <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28"/><Skeleton className="h-28"/><Skeleton className="h-28"/></div>
      </div>
    );
  }

  const points = data.me?.points ?? 0;
  const level = data.me?.level ?? 1;
  const nextLevelAt = level * 100;
  const progressPct = Math.min(100, Math.round((points / nextLevelAt) * 100));
  const teacherPhone = teacherWa || null;



  const quickActions = [
    { title: "الامتحانات", hint: "ابدأ أو راجع نتيجتك", url: "/student/exams", icon: FileText, tone: "bg-accent/10 text-accent" },
    { title: "الملفات", hint: "مذكرات ومراجعات", url: "/student/files", icon: FolderOpen, tone: "bg-primary/10 text-primary" },
    { title: "الرسائل", hint: "تواصل مع المدرس", url: "/student/messages", icon: MessageSquare, tone: "bg-warning/20 text-warning-foreground" },
    { title: "المساعد", hint: "اسأل في المادة", url: "/student/assistant", icon: Sparkles, tone: "bg-gold/20 text-gold-foreground" },
  ] as const;

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-lg md:rounded-3xl">
        <div className="p-4 md:p-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:flex md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary-foreground/70 md:text-sm">أهلاً بك</p>
              <h1 className="mt-1 truncate text-2xl font-extrabold md:text-3xl">{profile?.full_name ?? profile?.identifier}</h1>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">كل دروسك وامتحاناتك ورسائلك في مكان واحد.</p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2">
              <div className="min-w-20 rounded-xl bg-primary-foreground/10 px-3 py-2 text-center">
                <p className="text-[11px] text-primary-foreground/70">النقاط</p>
                <p className="text-2xl font-extrabold text-gold">{points}</p>
              </div>
              <div className="min-w-20 rounded-xl bg-primary-foreground/10 px-3 py-2 text-center">
                <p className="text-[11px] text-primary-foreground/70">المستوى</p>
                <p className="text-2xl font-extrabold">{level}</p>
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-1.5">
            <div className="flex justify-between text-xs text-primary-foreground/80">
              <span>التقدم للمستوى {level + 1}</span>
              <span>{points} / {nextLevelAt}</span>
            </div>
            <Progress value={progressPct} className="h-2 bg-primary-foreground/20" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.url}
            to={action.url}
            className="group rounded-2xl border border-border/70 bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${action.tone}`}>
                <action.icon className="h-5 w-5" />
              </span>
              <ChevronLeft className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:-translate-x-1" />
            </div>
            <p className="mt-3 font-bold text-foreground">{action.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.hint}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-3 sm:grid-cols-3 md:gap-4">
        <StatCard title="جوائزي" value={data.rewardsCount} icon={Award} accent="gold" />
        <StatCard title="إشعارات جديدة" value={data.unread} icon={Bell} accent="warning" />
        <StatCard title="نقاطي" value={points} icon={Star} accent="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {studentId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Camera className="h-5 w-5 text-primary"/>صورتي الشخصية</CardTitle>
              <CardDescription>تظهر صورتك في الكارت ولوحة الطالب</CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarUploader table="students" rowId={studentId} currentUrl={profile?.avatar_url}
                fallback={profile?.full_name ?? "ط"} onChange={() => refresh()} />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-5 w-5 text-accent"/>تواصل ولي الأمر</CardTitle>
            <CardDescription>فتح رسالة جاهزة للمدرس عبر واتساب</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <WhatsAppButton phone={teacherPhone} template="wa.tpl.teacher_contact" vars={{ name: profile?.full_name ?? "", code: profile?.identifier ?? "" }} label="فتح واتساب المدرس" className="w-full sm:w-auto" />
            {!teacherPhone && <p className="text-xs text-muted-foreground">لم يقم المدرس بإضافة رقم واتساب بعد.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary"/>آخر الإعلانات</CardTitle>
          <CardDescription>إعلانات ومستجدات من المدرس</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد إعلانات حاليًا.</p>
          ) : data.announcements.map((a: any) => (
            <div key={a.id} className="border-r-4 border-primary bg-muted/30 rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-sm">{a.title}</p>
                {a.priority === "high" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">عاجل</span>}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
