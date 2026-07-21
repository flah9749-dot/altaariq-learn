import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Trophy, Star, Award, Bell, TrendingUp } from "lucide-react";
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
  const parentPhone = data.me?.parent_whatsapp ?? data.me?.parent_phone ?? null;
  const teacherPhone = teacherWa || null;


  return (
    <div className="space-y-6">
      {studentId && (
        <Card>
          <CardHeader><CardTitle className="text-base">صورتي الشخصية</CardTitle></CardHeader>
          <CardContent>
            <AvatarUploader table="students" rowId={studentId} currentUrl={profile?.avatar_url}
              fallback={profile?.full_name ?? "ط"} onChange={() => refresh()} />
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-0 bg-gradient-to-l from-primary to-primary/80 text-primary-foreground">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-primary-foreground/70">أهلاً بك</p>
              <h1 className="text-2xl md:text-3xl font-bold mt-1">{profile?.full_name ?? profile?.identifier}</h1>
              <p className="text-primary-foreground/80 mt-2 text-sm">استمر في التعلم واجمع النقاط لترتقي بمستواك.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/10 px-4 py-3 min-w-[110px]">
                <p className="text-xs text-primary-foreground/70">النقاط</p>
                <p className="text-2xl font-bold text-gold">{points}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 min-w-[110px]">
                <p className="text-xs text-primary-foreground/70">المستوى</p>
                <p className="text-2xl font-bold">{level}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-1">
            <div className="flex justify-between text-xs text-primary-foreground/80">
              <span>التقدم للمستوى {level + 1}</span>
              <span>{points} / {nextLevelAt}</span>
            </div>
            <Progress value={progressPct} className="h-2 bg-white/20" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="الامتحانات المتاحة" value="—" icon={FileText} accent="accent" hint="ستظهر لاحقًا" />
        <StatCard title="جوائزي" value={data.rewardsCount} icon={Award} accent="gold" />
        <StatCard title="إشعارات جديدة" value={data.unread} icon={Bell} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-gold"/>آخر الجوائز</CardTitle>
            <CardDescription>الجوائز التي حصلت عليها مؤخرًا</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">لم تحصل على جوائز بعد. استمر في الحل!</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-accent"/>تواصل ولي الأمر</CardTitle>
            <CardDescription>يمكن لولي الأمر التواصل مع المدرس مباشرة عبر واتساب</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <WhatsAppButton phone={teacherPhone} message={`السلام عليكم أستاذ، بخصوص الطالب/ة ${profile?.full_name ?? ""} (${profile?.identifier ?? ""})`} label="فتح واتساب المدرس" />
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
