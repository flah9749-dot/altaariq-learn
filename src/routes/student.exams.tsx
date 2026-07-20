import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, Play, CheckCircle2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { deriveStatus, STATUS_LABEL, STATUS_COLOR } from "@/lib/exam-utils";
import { formatArabicDateTime } from "@/lib/students-utils";

export const Route = createFileRoute("/student/exams")({
  head: () => ({ meta: [{ title: "امتحاناتي — الطارق التعليمية" }] }),
  component: StudentExamsPage,
});

function StudentExamsPage() {
  const { user } = useAuth();

  const { data: student } = useQuery({
    queryKey: ["me-student", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("id,class_id,group_id").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: exams, isLoading } = useQuery({
    queryKey: ["student-exams", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase.from("exams")
        .select("*").eq("published", true).order("created_at", { ascending: false });
      return (data ?? []).filter((e: any) => {
        if (e.class_id && student?.class_id && e.class_id !== student.class_id) return false;
        return true;
      });
    },
  });

  const { data: myAttempts } = useQuery({
    queryKey: ["my-attempts", student?.id], enabled: !!student,
    queryFn: async () => (await supabase.from("exam_attempts").select("exam_id,status,percentage,id")
      .eq("student_id", student!.id)).data ?? [],
  });

  const attemptByExam = new Map((myAttempts ?? []).map((a: any) => [a.exam_id, a]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />امتحاناتي
        </h1>
        <p className="text-sm text-muted-foreground mt-1">جميع الامتحانات المتاحة لك</p>
      </div>

      {isLoading ? <Skeleton className="h-40" /> :
       (exams ?? []).length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد امتحانات متاحة حاليًا</CardContent></Card>
       ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(exams ?? []).map((e: any) => {
            const status = deriveStatus(e);
            const att = attemptByExam.get(e.id) as any | undefined;
            const done = att?.status === "graded" || att?.status === "submitted";
            const canTake = status === "published" && (!att || att.status === "in_progress");
            return (
              <Card key={e.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{e.title}</CardTitle>
                    <Badge className={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
                  </div>
                  {e.subject && <p className="text-sm text-muted-foreground">{e.subject}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{e.duration_minutes} دقيقة</div>
                    <div className="flex items-center gap-1 text-muted-foreground"><FileText className="h-3 w-3" />{e.total_score} درجة</div>
                  </div>
                  {e.starts_at && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{formatArabicDateTime(e.starts_at)}</div>}
                  {done && (
                    <div className="bg-success/10 border border-success/30 rounded-lg p-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-success inline ml-1" />
                      نتيجتك: <span className="font-bold">{att.percentage}%</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {canTake && (
                      <Button asChild className="flex-1"><Link to="/student/exams/$id" params={{ id: e.id }}>
                        <Play className="h-4 w-4 ml-1" />{att?.status === "in_progress" ? "استكمال" : "بدء الامتحان"}
                      </Link></Button>
                    )}
                    {done && (
                      <Button asChild variant="outline" className="flex-1"><Link to="/student/exams/$id/result" params={{ id: e.id }}>
                        عرض النتيجة
                      </Link></Button>
                    )}
                    {status === "ended" && !done && (
                      <Button disabled className="flex-1" variant="outline">انتهى الوقت</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
       )}
    </div>
  );
}
