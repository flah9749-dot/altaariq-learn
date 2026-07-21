import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, ScanLine, Edit, MessageSquare, Trophy, Star, Award, FileText,
  Phone, Calendar, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { formatArabicDate, formatArabicDateTime, type StudentRow } from "@/lib/students-utils";

export const Route = createFileRoute("/admin/students/quick/$code")({
  head: () => ({ meta: [{ title: "بطاقة الطالب السريعة" }] }),
  component: QuickStudentPage,
});

function QuickStudentPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  const { data: student, isLoading } = useQuery({
    queryKey: ["student-by-code", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, classes(id,name), groups(id,name)")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as StudentRow | null;
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["student-recent", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const [results, badges] = await Promise.all([
        supabase.from("results").select("score, total, created_at, exams(title)").eq("student_id", student!.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("student_badges").select("badges(name)", { count: "exact", head: true }).eq("student_id", student!.id),
      ]);
      const all = await supabase.from("results").select("score, total").eq("student_id", student!.id);
      const rs = all.data ?? [];
      const totalExams = rs.length;
      const avg = totalExams ? Math.round(rs.reduce((a, r) => a + (r.total ? (r.score / r.total) * 100 : 0), 0) / totalExams) : 0;
      const last = results.data?.[0];
      return {
        lastExam: last ? {
          title: (last as any).exams?.title ?? "امتحان",
          pct: last.total ? Math.round((last.score / last.total) * 100) : 0,
          date: last.created_at,
        } : null,
        avg,
        totalExams,
        badgesCount: badges.count ?? 0,
      };
    },
  });

  if (isLoading) {
    return <div className="max-w-3xl mx-auto space-y-4"><Skeleton className="h-24" /><Skeleton className="h-56" /></div>;
  }

  if (!student) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="mx-auto p-4 rounded-2xl bg-destructive/10 text-destructive w-fit"><ScanLine className="h-8 w-8" /></div>
        <h2 className="text-xl font-bold">الطالب غير موجود</h2>
        <p className="text-muted-foreground text-sm">الكود <code className="font-mono">{code}</code> غير مسجل.</p>
        <Button asChild variant="outline"><Link to="/admin/scan">مسح كود آخر</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/scan" })}>
          <ArrowRight className="h-4 w-4 ml-1" />رجوع للمسح
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-l from-primary via-primary/80 to-primary/60" />
        <CardContent className="p-6 pt-0 -mt-14">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={student.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">{student.full_name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold truncate">{student.full_name}</h1>
                {student.status === "active"
                  ? <Badge className="bg-success text-success-foreground">نشط</Badge>
                  : <Badge variant="destructive">موقوف</Badge>}
                {student.archived_at && <Badge variant="outline">مؤرشف</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="font-mono">{student.code}</Badge>
                {student.classes?.name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{student.classes.name}</span>}
                {student.groups?.name && <span>• {student.groups.name}</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <Stat icon={Trophy} label="النقاط" value={student.points} />
            <Stat icon={Star} label="المستوى" value={student.level} />
            <Stat icon={FileText} label="الامتحانات" value={recent?.totalExams ?? 0} />
            <Stat icon={Award} label="الشارات" value={recent?.badgesCount ?? 0} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 mt-6">
            <InfoRow icon={FileText} label="آخر امتحان"
              value={recent?.lastExam ? `${recent.lastExam.title} — ${recent.lastExam.pct}%` : "لا يوجد"} />
            <InfoRow icon={Star} label="المتوسط العام" value={`${recent?.avg ?? 0}%`} />
            <InfoRow icon={Calendar} label="آخر دخول" value={formatArabicDateTime(student.last_seen)} />
            <InfoRow icon={Calendar} label="تاريخ التسجيل" value={formatArabicDate(student.created_at)} />
            <InfoRow icon={Phone} label="هاتف الطالب" value={student.phone ?? "—"} />
            <InfoRow icon={Phone} label="هاتف ولي الأمر" value={student.parent_phone ?? "—"} />
          </div>

          <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t">
            <WhatsAppButton
              phone={student.parent_whatsapp ?? student.parent_phone}
              template="wa.tpl.parent_intro"
              vars={{ name: student.full_name }}
              label="واتساب ولي الأمر"
            />
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/admin/messages"><MessageSquare className="h-4 w-4" />فتح المحادثة</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/admin/students/$id" params={{ id: student.id }}><Edit className="h-4 w-4" />الكارت الكامل</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <Icon className="h-5 w-5 mx-auto text-primary" />
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
      <span className="text-muted-foreground flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}
