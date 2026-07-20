import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, Play, CheckCircle2, Calendar, Award, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { deriveStatus, STATUS_LABEL, STATUS_COLOR, computeGrade } from "@/lib/exam-utils";
import { formatArabicDateTime } from "@/lib/students-utils";

export const Route = createFileRoute("/student/exams")({
  head: () => ({ meta: [{ title: "امتحاناتي — الطارق التعليمية" }] }),
  component: StudentExamsPage,
});

type Bucket = "available" | "upcoming" | "ended" | "solved";

function StudentExamsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Bucket>("available");

  const { data: student } = useQuery({
    queryKey: ["me-student", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("id,class_id,group_id").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: exams, isLoading } = useQuery({
    queryKey: ["student-exams", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase.from("exams")
        .select("*, classes(name), groups:groups!exams_group_id_fkey(name)")
        .eq("published", true).order("created_at", { ascending: false });
      return (data ?? []).filter((e: any) => {
        if (e.class_id && student?.class_id && e.class_id !== student.class_id) return false;
        return true;
      });
    },
  });

  const { data: myAttempts } = useQuery({
    queryKey: ["my-attempts", student?.id], enabled: !!student,
    queryFn: async () => (await supabase.from("exam_attempts").select("exam_id,status,percentage,id,approved")
      .eq("student_id", student!.id)).data ?? [],
  });

  const attemptByExam = new Map((myAttempts ?? []).map((a: any) => [a.exam_id, a]));

  const buckets = useMemo(() => {
    const b: Record<Bucket, any[]> = { available: [], upcoming: [], ended: [], solved: [] };
    (exams ?? []).forEach((e: any) => {
      const st = deriveStatus(e);
      const att = attemptByExam.get(e.id) as any | undefined;
      const done = att && (att.status === "graded" || att.status === "submitted");
      if (done) { b.solved.push(e); return; }
      if (st === "scheduled") b.upcoming.push(e);
      else if (st === "ended") b.ended.push(e);
      else b.available.push(e);
    });
    return b;
  }, [exams, attemptByExam]);

  const tabsMeta: { key: Bucket; label: string; color: string }[] = [
    { key: "available", label: "المتاحة الآن", color: "text-success" },
    { key: "upcoming", label: "القادمة", color: "text-warning" },
    { key: "solved", label: "تم حلها", color: "text-primary" },
    { key: "ended", label: "المنتهية", color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />امتحاناتي
        </h1>
        <p className="text-sm text-muted-foreground mt-1">جميع الامتحانات المتاحة لك</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tabsMeta.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-xl border p-4 text-right transition-all ${tab === t.key ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-muted/50"}`}>
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className={`text-2xl font-bold ${t.color}`}>{buckets[t.key].length}</p>
          </button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Bucket)}>
        <TabsList className="grid grid-cols-4 w-full">
          {tabsMeta.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
        {tabsMeta.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            {isLoading ? <Skeleton className="h-40" /> :
             buckets[t.key].length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد امتحانات في هذا القسم</CardContent></Card>
             ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {buckets[t.key].map((e: any) => (
                  <ExamCard key={e.id} exam={e} attempt={attemptByExam.get(e.id) as any | undefined} bucket={t.key} />
                ))}
              </div>
             )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ExamCard({ exam: e, attempt: att, bucket }: { exam: any; attempt?: any; bucket: Bucket }) {
  const status = deriveStatus(e);
  const done = att?.status === "graded" || att?.status === "submitted";
  const pct = Number(att?.percentage) || 0;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{e.title}</CardTitle>
          <Badge className={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
        {e.subject && <p className="text-sm text-muted-foreground">{e.subject}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {e.classes?.name && <div className="flex items-center gap-1"><Users className="h-3 w-3" />{e.classes.name}</div>}
          <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.duration_minutes} دقيقة</div>
          <div className="flex items-center gap-1"><FileText className="h-3 w-3" />{e.total_score} درجة</div>
          <div className="flex items-center gap-1"><Award className="h-3 w-3" />{e.attempts_allowed} محاولة</div>
        </div>
        {e.starts_at && <div className="flex items-center gap-1 text-xs text-muted-foreground border-t pt-2"><Calendar className="h-3 w-3" />يبدأ: {formatArabicDateTime(e.starts_at)}</div>}
        {e.ends_at && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />ينتهي: {formatArabicDateTime(e.ends_at)}</div>}

        {done && (
          <div className="bg-success/10 border border-success/30 rounded-lg p-2 text-sm">
            <div className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-success" /><span>نتيجتك: <b>{pct}%</b> — {computeGrade(pct)}</span></div>
            {att?.approved && <p className="text-xs text-success mt-1">✓ نتيجة معتمدة</p>}
          </div>
        )}

        <div className="flex gap-2">
          {bucket === "available" && (
            <Button asChild className="flex-1"><Link to="/student/exams/$id/start" params={{ id: e.id }}>
              <Play className="h-4 w-4 ml-1" />{att?.status === "in_progress" ? "استكمال" : "بدء الامتحان"}
            </Link></Button>
          )}
          {bucket === "solved" && (
            <Button asChild variant="outline" className="flex-1"><Link to="/student/exams/$id/result" params={{ id: e.id }}>
              عرض النتيجة
            </Link></Button>
          )}
          {bucket === "upcoming" && (
            <Button disabled className="flex-1" variant="outline">لم يبدأ بعد</Button>
          )}
          {bucket === "ended" && !done && (
            <Button disabled className="flex-1" variant="outline">انتهى الوقت</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
