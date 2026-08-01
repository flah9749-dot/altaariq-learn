import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Send, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listTeacherQuestions, answerTeacherQuestion } from "@/lib/teacher-questions.functions";

export const Route = createFileRoute("/admin/ai/questions")({
  head: () => ({
    meta: [
      { title: "أسئلة الطلاب للمدرس | الطارق التعليمية" },
      { name: "description", content: "الأسئلة التي لم يجد لها المساعد الذكي إجابة في المنهج — أجب عليها لتُضاف لقاعدة المعرفة." },
      { property: "og:title", content: "أسئلة الطلاب للمدرس" },
      { property: "og:description", content: "أجب على أسئلة الطلاب وأضف إجابتك لقاعدة المعرفة تلقائياً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherQuestionsPage,
});

function TeacherQuestionsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeacherQuestions);
  const answerFn = useServerFn(answerTeacherQuestion);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-questions"],
    queryFn: () => listFn({ data: { status: null } }),
  });

  const mut = useMutation({
    mutationFn: (v: { id: string; answer: string }) => answerFn({ data: { id: v.id, answer: v.answer, addToKb: true } }),
    onSuccess: (r) => {
      toast.success(r.addedToKb ? "تم الإرسال وإضافة الإجابة لقاعدة المعرفة" : "تم إرسال الإجابة للطالب");
      qc.invalidateQueries({ queryKey: ["teacher-questions"] });
      qc.invalidateQueries({ queryKey: ["kb-documents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  const rows = (data?.questions ?? []) as any[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <MessagesSquare className="h-5 w-5" />
          </span>
          أسئلة الطلاب للمدرس
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          أسئلة لم يجد المساعد لها سنداً في المنهج. إجابتك تُضاف لقاعدة المعرفة ليستخدمها تلقائياً لاحقاً.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
      {!isLoading && rows.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">لا توجد أسئلة حالياً.</CardContent></Card>
      )}

      {rows.map((q) => (
        <Card key={q.id}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={q.status === "answered" ? "secondary" : "default"}>
                {q.status === "answered" ? "تمت الإجابة" : "بانتظار الرد"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {q.students?.full_name ?? "طالب"} {q.classes?.name ? `• ${q.classes.name}` : ""}
              </span>
              {q.added_to_kb && <Badge variant="outline">في قاعدة المعرفة</Badge>}
            </div>
            <CardTitle className="text-base mt-2">{q.question}</CardTitle>
            {q.ai_draft && (
              <CardDescription className="mt-1 line-clamp-3">مسودة المساعد: {q.ai_draft}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {q.status === "answered" ? (
              <div className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap">{q.answer}</div>
            ) : (
              <>
                <Textarea
                  rows={4}
                  placeholder="اكتب الإجابة النموذجية..."
                  value={drafts[q.id] ?? ""}
                  onChange={(e) => setDrafts((s) => ({ ...s, [q.id]: e.target.value }))}
                />
                <Button
                  className="gap-2"
                  disabled={(drafts[q.id]?.trim().length ?? 0) < 2 || mut.isPending}
                  onClick={() => mut.mutate({ id: q.id, answer: drafts[q.id] })}
                >
                  {mut.isPending && mut.variables?.id === q.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                  إرسال وإضافة لقاعدة المعرفة
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
