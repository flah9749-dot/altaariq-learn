import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, Award, ArrowRight, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { formatDuration, computeGrade } from "@/lib/exam-utils";

export const Route = createFileRoute("/student/exams/$id/result")({
  head: () => ({ meta: [{ title: "نتيجة الامتحان" }] }),
  component: ResultPage,
});

function ResultPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();

  const { data: student } = useQuery({
    queryKey: ["me-student", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("id,full_name,parent_phone,parent_whatsapp").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: attempt, isLoading } = useQuery({
    queryKey: ["my-attempt", id, student?.id], enabled: !!student,
    queryFn: async () => (await supabase.from("exam_attempts")
      .select("*, exams(title,show_result_mode)")
      .eq("exam_id", id).eq("student_id", student!.id)
      .order("submitted_at", { ascending: false }).limit(1).maybeSingle()).data,
  });
  const { data: answers } = useQuery({
    queryKey: ["my-answers", attempt?.id], enabled: !!attempt,
    queryFn: async () => (await supabase.from("attempt_answers")
      .select("*, questions(id,text,type,points,explanation)")
      .eq("attempt_id", attempt!.id)).data ?? [],
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!attempt) return <Card><CardContent className="py-16 text-center">لم تُؤدِ هذا الامتحان</CardContent></Card>;

  const pct = Number(attempt.percentage) || 0;
  const grade = attempt.grade ?? computeGrade(pct);
  const showAnswers = attempt.exams?.show_result_mode === "immediate" && attempt.status === "graded";
  const waMsg = `مرحبًا، نتيجة الطالب ${student?.full_name} في امتحان "${attempt.exams?.title}":
الدرجة: ${attempt.score}/${attempt.total} (${pct}%)
التقدير: ${grade}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/student/exams"><ArrowRight className="h-4 w-4 ml-1" />الرجوع للامتحانات</Link>
      </Button>

      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="h-16 w-16 mx-auto text-gold" />
          <h1 className="text-2xl font-bold">{attempt.exams?.title}</h1>
          <div className="text-6xl font-bold">{pct}%</div>
          <p className="text-xl">{grade}</p>
          <Progress value={pct} className="h-3 bg-white/20" />
          <div className="grid grid-cols-3 gap-3 pt-4">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs opacity-80">الدرجة</p>
              <p className="text-xl font-bold">{attempt.score} / {attempt.total}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs opacity-80">الوقت</p>
              <p className="text-xl font-bold">{formatDuration(attempt.time_spent_sec ?? 0)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs opacity-80">الحالة</p>
              <p className="text-sm font-bold">{attempt.status === "graded" ? "مصححة" : "قيد المراجعة"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <WhatsAppButton phone={student?.parent_whatsapp ?? student?.parent_phone} message={waMsg} label="إرسال النتيجة لولي الأمر عبر واتساب" />
      </div>

      {attempt.status !== "graded" ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2" />النتيجة قيد المراجعة من المدرس
        </CardContent></Card>
      ) : showAnswers && (
        <Card>
          <CardHeader><CardTitle>مراجعة الإجابات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(answers ?? []).map((a: any, i: number) => (
              <div key={a.id} className={`border rounded-lg p-3 ${a.is_correct === true ? "border-success/30 bg-success/5" : a.is_correct === false ? "border-destructive/30 bg-destructive/5" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{i + 1}</Badge>
                  {a.is_correct === true && <CheckCircle2 className="h-4 w-4 text-success" />}
                  {a.is_correct === false && <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="mr-auto text-sm">{a.awarded_points ?? 0} / {a.questions?.points}</span>
                </div>
                <p className="font-medium text-sm">{a.questions?.text}</p>
                {a.questions?.explanation && <p className="text-xs text-muted-foreground mt-2 border-t pt-2">💡 {a.questions.explanation}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
