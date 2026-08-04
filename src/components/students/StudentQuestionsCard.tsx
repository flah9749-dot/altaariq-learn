import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircleQuestion, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { studentTeacherQuestions } from "@/lib/teacher-questions.functions";

/** Archive of the questions this student sent to the teacher, with the answers. */
export function StudentQuestionsCard({ studentId }: { studentId: string }) {
  const fn = useServerFn(studentTeacherQuestions);
  const { data, isLoading } = useQuery({
    queryKey: ["student-teacher-questions", studentId],
    queryFn: async () => (await fn({ data: { studentId } })) as { questions: any[] },
  });
  const rows = data?.questions ?? [];

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircleQuestion className="h-4 w-4 text-primary" />
          أسئلة الطالب للمدرس
          {rows.length > 0 && <Badge variant="secondary">{rows.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد أسئلة مرسلة من هذا الطالب.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{r.question}</p>
                  <Badge variant={r.status === "answered" ? "default" : "secondary"} className="shrink-0">
                    {r.status === "answered" ? "تمت الإجابة" : "بانتظار الرد"}
                  </Badge>
                </div>
                {r.answer && <p className="text-sm bg-muted rounded p-2 whitespace-pre-wrap">{r.answer}</p>}
                <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
