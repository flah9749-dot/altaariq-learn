import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, Trophy, MessageSquare, Bell, GraduationCap, Bot, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "الرئيسية — لوحة المدرس" }] }),
  component: AdminDashboard,
});

async function fetchStats() {
  const [students, exams, classes, published, notif, rewards] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("exams").select("id", { count: "exact", head: true }),
    supabase.from("classes").select("id", { count: "exact", head: true }),
    supabase.from("exams").select("id", { count: "exact", head: true }).eq("published", true),
    supabase.from("notifications").select("id", { count: "exact", head: true }),
    supabase.from("rewards").select("id", { count: "exact", head: true }),
  ]);
  return {
    students: students.count ?? 0,
    exams: exams.count ?? 0,
    classes: classes.count ?? 0,
    published: published.count ?? 0,
    notifications: notif.count ?? 0,
    rewards: rewards.count ?? 0,
  };
}

function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: fetchStats });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">لوحة تحكم المدرس</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة عامة على المنصة والنشاط الحالي</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard title="عدد الطلاب" value={data!.students} icon={Users} accent="primary" />
          <StatCard title="الفصول" value={data!.classes} icon={GraduationCap} accent="accent" />
          <StatCard title="الامتحانات" value={data!.exams} icon={FileText} accent="gold" hint={`${data!.published} منشور`} />
          <StatCard title="الجوائز" value={data!.rewards} icon={Trophy} accent="success" />
          <StatCard title="الإشعارات" value={data!.notifications} icon={Bell} accent="warning" />
          <StatCard title="نظام AI" value="جاهز" icon={Bot} accent="accent" hint="متعدد المزودين" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary"/>آخر النشاطات</CardTitle>
            <CardDescription>يظهر هنا آخر النشاطات الطلابية والرسائل</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">لا توجد نشاطات بعد — ابدأ بإضافة طلاب وامتحانات.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-gold"/>المتصدرون</CardTitle>
            <CardDescription>قائمة الطلاب الأعلى نقاطًا</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">لا يوجد طلاب بعد.</CardContent>
        </Card>
      </div>
    </div>
  );
}
