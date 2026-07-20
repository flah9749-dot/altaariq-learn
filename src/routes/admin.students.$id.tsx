import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Edit, Printer, Trophy, Star, FileText, MessageSquare,
  Phone, Calendar, MapPin, User, Award, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { StudentIdCard } from "@/components/students/StudentIdCard";
import { StudentFormDialog } from "@/components/students/StudentFormDialog";
import { formatArabicDate, formatArabicDateTime, type StudentRow } from "@/lib/students-utils";

export const Route = createFileRoute("/admin/students/$id")({
  head: () => ({ meta: [{ title: "كارت الطالب — لوحة المدرس" }] }),
  component: StudentDetailPage,
});

function StudentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, classes(id,name), groups(id,name)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as unknown as StudentRow | null;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["student-stats", id],
    queryFn: async () => {
      const [results, rewards] = await Promise.all([
        supabase.from("results").select("score,total").eq("student_id", id),
        supabase.from("rewards").select("id", { count: "exact", head: true }).eq("student_id", id),
      ]);
      const rs = results.data ?? [];
      const totalExams = rs.length;
      const avg = totalExams ? Math.round(rs.reduce((a, r) => a + (r.total ? (r.score / r.total) * 100 : 0), 0) / totalExams) : 0;
      const passRate = totalExams ? Math.round((rs.filter((r) => r.total && r.score / r.total >= 0.5).length / totalExams) * 100) : 0;
      return { totalExams, avg, passRate, rewardsCount: rewards.count ?? 0 };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (!student) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">الطالب غير موجود</p>
        <Button asChild variant="link"><Link to="/admin/students">العودة للقائمة</Link></Button>
      </div>
    );
  }

  const nextLevelAt = (student.level ?? 1) * 100;
  const progressPct = Math.min(100, Math.round((student.points / nextLevelAt) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/students" })}>
          <ArrowRight className="h-4 w-4 ml-1" />القائمة
        </Button>
        <div className="mr-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 ml-1" />طباعة</Button>
          <Button size="sm" onClick={() => setEditOpen(true)}><Edit className="h-4 w-4 ml-1" />تعديل</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-28 w-28 border-4 border-primary/10">
                <AvatarImage src={student.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">{student.full_name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">{student.full_name}</h1>
                  {student.status === "active"
                    ? <Badge className="bg-success text-success-foreground">نشط</Badge>
                    : <Badge variant="destructive">موقوف</Badge>}
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="font-mono">{student.code}</Badge>
                  {student.classes?.name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{student.classes.name}</span>}
                  {student.groups?.name && <span>• {student.groups.name}</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <Stat icon={Trophy} label="النقاط" value={student.points} color="text-gold" />
                  <Stat icon={Star} label="المستوى" value={student.level} color="text-primary" />
                  <Stat icon={FileText} label="الامتحانات" value={stats?.totalExams ?? 0} color="text-accent" />
                  <Stat icon={Award} label="الجوائز" value={stats?.rewardsCount ?? 0} color="text-warning" />
                </div>
                <div className="pt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>التقدم للمستوى التالي</span>
                    <span>{student.points} / {nextLevelAt}</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-3 print:mx-auto">
          <StudentIdCard student={student} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 print:hidden">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />بيانات شخصية</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row label="الجنس" value={student.gender === "male" ? "ذكر" : student.gender === "female" ? "أنثى" : "—"} />
            <Row label="تاريخ الميلاد" icon={Calendar} value={formatArabicDate(student.birth_date)} />
            <Row label="الهاتف" icon={Phone} value={student.phone ?? "—"} />
            <Row label="العنوان" icon={MapPin} value={student.address ?? "—"} />
            <Row label="ملاحظات" value={student.notes ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">ولي الأمر</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row label="الاسم" value={student.parent_name ?? "—"} />
            <Row label="الهاتف" icon={Phone} value={student.parent_phone ?? "—"} />
            <Row label="واتساب" value={student.parent_whatsapp ?? student.parent_phone ?? "—"} />
            <div className="pt-2">
              <WhatsAppButton phone={student.parent_whatsapp ?? student.parent_phone} label="فتح واتساب ولي الأمر" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />الأداء</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row label="متوسط الدرجات" value={`${stats?.avg ?? 0}%`} />
            <Row label="نسبة النجاح" value={`${stats?.passRate ?? 0}%`} />
            <Row label="آخر دخول" value={formatArabicDateTime(student.last_seen)} />
            <Row label="تاريخ التسجيل" value={formatArabicDate(student.created_at)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 print:hidden">
        <QuickAction icon={FileText} label="الامتحانات" href="/admin/exams" />
        <QuickAction icon={MessageSquare} label="الرسائل" href="/admin/messages" />
        <QuickAction icon={Award} label="الجوائز" href="/admin/rewards" />
        <QuickAction icon={Trophy} label="النقاط والنتائج" href="/admin/reports" />
      </div>

      <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} student={student} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <Icon className={`h-5 w-5 mx-auto ${color}`} />
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {Icon && <Icon className="h-3.5 w-3.5" />}{label}
      </span>
      <span className="font-medium text-end">{value}</span>
    </div>
  );
}

function QuickAction({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
  return (
    <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
      <Link to={href}>
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </Link>
    </Button>
  );
}
