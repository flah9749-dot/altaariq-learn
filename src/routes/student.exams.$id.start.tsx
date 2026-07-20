import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, Award, Users, ArrowRight, Play, AlertCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatArabicDateTime } from "@/lib/students-utils";

export const Route = createFileRoute("/student/exams/$id/start")({
  head: () => ({ meta: [{ title: "بدء الامتحان" }] }),
  component: StartExamPage,
});

function StartExamPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const { data: exam, isLoading } = useQuery({
    queryKey: ["exam-start", id],
    queryFn: async () => (await supabase.from("exams")
      .select("*, classes(name), questions(id)").eq("id", id).eq("published", true).maybeSingle()).data,
  });
  const { data: student } = useQuery({
    queryKey: ["me-start", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("full_name,code,avatar_url").eq("user_id", user!.id).maybeSingle()).data,
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!exam) return <Card><CardContent className="py-16 text-center">الامتحان غير متاح</CardContent></Card>;

  const qCount = exam.questions?.length ?? 0;
  const ac: any = exam.anti_cheat ?? {};

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/student/exams"><ArrowRight className="h-4 w-4 ml-1" />الرجوع للامتحانات</Link>
      </Button>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground p-6">
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          {exam.subject && <p className="opacity-90 mt-1">{exam.subject}</p>}
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="الطالب" value={student?.full_name ?? "—"} />
            <InfoRow label="الكود" value={student?.code ?? "—"} mono />
            {exam.classes?.name && <InfoRow label="الصف" value={exam.classes.name} />}
            <InfoRow label="عدد الأسئلة" value={`${qCount}`} icon={FileText} />
            <InfoRow label="الدرجة الكلية" value={`${exam.total_score}`} icon={Award} />
            <InfoRow label="الزمن" value={`${exam.duration_minutes} دقيقة`} icon={Clock} />
            <InfoRow label="عدد المحاولات" value={`${exam.attempts_allowed}`} icon={Users} />
            {exam.starts_at && <InfoRow label="يبدأ" value={formatArabicDateTime(exam.starts_at)} />}
            {exam.ends_at && <InfoRow label="ينتهي" value={formatArabicDateTime(exam.ends_at)} />}
          </div>

          {exam.description && (
            <div className="border-t pt-4">
              <p className="font-semibold mb-1">وصف الامتحان:</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{exam.description}</p>
            </div>
          )}

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-1">تعليمات مهمة:</p>
              <ul className="text-xs space-y-1 list-disc pr-4">
                <li>لديك {exam.duration_minutes} دقيقة لإنهاء الامتحان.</li>
                <li>يتم حفظ إجاباتك تلقائيًا بعد كل اختيار.</li>
                <li>لا يمكنك تعديل الإجابات بعد التسليم.</li>
                {ac.block_copy && <li>ممنوع نسخ أو لصق النص أثناء الامتحان.</li>}
                {ac.track_leaves && <li>يتم تسجيل مغادرتك لصفحة الامتحان.</li>}
                {exam.shuffle_questions && <li>ترتيب الأسئلة عشوائي.</li>}
                <li>عند انتهاء الوقت يتم التسليم تلقائيًا.</li>
              </ul>
            </AlertDescription>
          </Alert>

          {qCount === 0 && (
            <Alert variant="destructive"><AlertCircle className="h-4 w-4" />
              <AlertDescription>لا توجد أسئلة في هذا الامتحان بعد.</AlertDescription>
            </Alert>
          )}

          <Button className="w-full h-12 text-base" disabled={qCount === 0}
            onClick={() => nav({ to: "/student/exams/$id", params: { id } })}>
            <Play className="h-5 w-5 ml-2" />ابدأ الامتحان الآن
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon, mono }: { label: string; value: string; icon?: any; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between bg-muted/40 rounded-lg p-3">
      <span className="text-xs text-muted-foreground flex items-center gap-1">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</span>
      <span className={`font-semibold ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
