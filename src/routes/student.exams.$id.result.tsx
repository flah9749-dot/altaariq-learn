import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, ArrowRight, Trophy, Trophy as TrophyIcon, Target, HelpCircle, Users, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { pickResultTemplate } from "@/lib/whatsapp-templates";
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
    queryFn: async () => (await supabase.from("students")
      .select("id,full_name,parent_phone,parent_whatsapp,class_id,group_id").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: attempt, isLoading } = useQuery({
    queryKey: ["my-attempt", id, student?.id], enabled: !!student,
    queryFn: async () => (await supabase.from("exam_attempts")
      .select("*, exams(title,show_result_mode,total_score)")
      .eq("exam_id", id).eq("student_id", student!.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false }).limit(1).maybeSingle()).data,
  });

  const { data: answers } = useQuery({
    queryKey: ["my-answers", attempt?.id], enabled: !!attempt,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_attempt_review", { _attempt_id: attempt!.id });
      return (data as any[]) ?? [];
    },
  });

  // Rank in class and group
  const { data: rank } = useQuery({
    queryKey: ["rank", id, student?.id], enabled: !!student && !!attempt?.approved,
    queryFn: async () => {
      const { data: peers } = await supabase.from("exam_attempts")
        .select("student_id,percentage,students!inner(class_id,group_id)")
        .eq("exam_id", id).eq("approved", true).order("percentage", { ascending: false });
      const list = peers ?? [];
      const classPeers = list.filter((p: any) => p.students?.class_id === student?.class_id);
      const groupPeers = list.filter((p: any) => p.students?.group_id === student?.group_id && student?.group_id);
      const classRank = classPeers.findIndex((p: any) => p.student_id === student?.id) + 1;
      const groupRank = groupPeers.findIndex((p: any) => p.student_id === student?.id) + 1;
      return { classRank, classTotal: classPeers.length, groupRank, groupTotal: groupPeers.length };
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!attempt) return <Card><CardContent className="py-16 text-center">لم تُؤدِ هذا الامتحان</CardContent></Card>;

  const pct = Number(attempt.percentage) || 0;
  const grade = attempt.grade ?? computeGrade(pct);
  const showAnswers = attempt.exams?.show_result_mode === "immediate" && attempt.status === "graded";

  const correct = (answers ?? []).filter((a: any) => a.is_correct === true).length;
  const wrong = (answers ?? []).filter((a: any) => a.is_correct === false).length;
  const unanswered = (answers ?? []).filter((a: any) => a.answer == null || a.answer === "").length;

  const waVars = {
    name: student?.full_name ?? "",
    exam: attempt.exams?.title ?? "",
    score: attempt.score ?? 0,
    total: attempt.total ?? attempt.exams?.total_score ?? 0,
    percentage: pct,
    grade_text: grade,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/student/exams"><ArrowRight className="h-4 w-4 ml-1" />الرجوع للامتحانات</Link>
      </Button>

      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground overflow-hidden">
        <CardContent className="p-8 text-center space-y-4">
          <Trophy className="h-16 w-16 mx-auto text-gold" />
          <h1 className="text-2xl font-bold">{attempt.exams?.title}</h1>
          <div className="text-6xl font-bold">{pct}%</div>
          <p className="text-xl">{grade}</p>
          <Progress value={pct} className="h-3 bg-white/20" />
          <div className="grid grid-cols-3 gap-3 pt-4">
            <Metric label="الدرجة" value={`${attempt.score} / ${attempt.total}`} />
            <Metric label="الوقت" value={formatDuration(attempt.time_spent_sec ?? 0)} />
            <Metric label="الحالة" value={attempt.approved ? "معتمدة" : attempt.status === "graded" ? "مصححة" : "قيد المراجعة"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniCard icon={CheckCircle2} label="إجابات صحيحة" value={correct} color="text-success" />
        <MiniCard icon={XCircle} label="إجابات خاطئة" value={wrong} color="text-destructive" />
        <MiniCard icon={HelpCircle} label="لم تُجب" value={unanswered} color="text-muted-foreground" />
      </div>

      {rank && attempt.approved && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rank.classRank > 0 && <MiniCard icon={GraduationCap} label="ترتيبك على الصف" value={`${rank.classRank} / ${rank.classTotal}`} color="text-primary" />}
          {rank.groupRank > 0 && <MiniCard icon={Users} label="ترتيبك في المجموعة" value={`${rank.groupRank} / ${rank.groupTotal}`} color="text-gold" />}
        </div>
      )}

      {attempt.points_awarded > 0 && (
        <Card className="border-gold/40 bg-gold/5">
          <CardContent className="p-4 flex items-center gap-3">
            <TrophyIcon className="h-8 w-8 text-gold" />
            <div>
              <p className="font-bold">حصلت على {attempt.points_awarded} نقطة</p>
              <p className="text-xs text-muted-foreground">تمت إضافتها لرصيدك</p>
            </div>
          </CardContent>
        </Card>
      )}

      {attempt.admin_notes && (
        <Card><CardContent className="p-4">
          <p className="font-semibold text-sm mb-1">📝 ملاحظات المدرس:</p>
          <p className="text-sm whitespace-pre-wrap">{attempt.admin_notes}</p>
        </CardContent></Card>
      )}

      <div className="flex justify-center">
        <WhatsAppButton
          phone={student?.parent_whatsapp ?? student?.parent_phone}
          template={pickResultTemplate(pct)}
          vars={waVars}
          label="إرسال النتيجة لولي الأمر عبر واتساب"
        />
      </div>


      {attempt.status !== "graded" ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2" />النتيجة قيد المراجعة من المدرس
        </CardContent></Card>
      ) : showAnswers && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />مراجعة الإجابات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(answers ?? []).map((a: any, i: number) => {
              const correctOpts = a.questions?.question_options?.filter((o: any) => o.is_correct).map((o: any) => o.text).join(" / ");
              return (
                <div key={a.id} className={`border rounded-lg p-3 ${a.is_correct === true ? "border-success/30 bg-success/5" : a.is_correct === false ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    {a.is_correct === true && <CheckCircle2 className="h-4 w-4 text-success" />}
                    {a.is_correct === false && <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="mr-auto text-sm font-medium">{a.awarded_points ?? 0} / {a.questions?.points}</span>
                  </div>
                  <p className="font-medium text-sm">{a.questions?.text}</p>
                  {a.questions?.image_url && <img src={a.questions.image_url} alt="صورة السؤال" className="mt-2 max-h-64 rounded-lg border" />}
                  {correctOpts && a.is_correct === false && (
                    <p className="text-xs text-success mt-2">✓ الإجابة الصحيحة: {correctOpts}</p>
                  )}
                  {a.questions?.type === "map" && a.is_correct !== true && Array.isArray(a.questions?.correct_answer?.points) && a.questions.correct_answer.points.length > 0 && (
                    <p className="text-xs text-success mt-2">✓ الإجابة الصحيحة: {a.questions.correct_answer.points.map((p: any, idx: number) => `${idx + 1}. ${p.label}`).join(" — ")}</p>
                  )}
                  {a.questions?.explanation && <p className="text-xs text-muted-foreground mt-2 border-t pt-2">💡 {a.questions.explanation}</p>}
                  {a.ai_feedback && <p className="text-xs text-primary mt-2 border-t pt-2">🤖 تعليق: {a.ai_feedback}</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 rounded-xl p-3">
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function MiniCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color?: string }) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <Icon className={`h-8 w-8 ${color ?? "text-primary"}`} />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}
