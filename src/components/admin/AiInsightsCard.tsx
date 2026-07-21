import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { analyzeExamResults, analyzeStudent } from "@/lib/ai-assistant.functions";
import { toast } from "sonner";

type Props =
  | { kind: "exam"; examId: string; title?: string }
  | { kind: "student"; studentId: string; title?: string };

export function AiInsightsCard(props: Props) {
  const [text, setText] = useState<string>("");
  const examFn = useServerFn(analyzeExamResults);
  const studentFn = useServerFn(analyzeStudent);

  const mut = useMutation({
    mutationFn: async () => {
      if (props.kind === "exam") {
        const r = await examFn({ data: { examId: props.examId } });
        return r.insights;
      }
      const r = await studentFn({ data: { studentId: props.studentId } });
      return r.insights;
    },
    onSuccess: (r) => setText(r),
    onError: (e: any) => toast.error(e?.message ?? "فشل تحليل AI"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          {props.title ?? "تحليل الذكاء الاصطناعي"}
        </CardTitle>
        <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Sparkles className="h-4 w-4 ml-1" />}
          {text ? "إعادة التحليل" : "توليد التحليل"}
        </Button>
      </CardHeader>
      <CardContent>
        {text ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            اضغط "توليد التحليل" ليقوم المساعد الذكي بتحليل البيانات وتقديم توصيات عملية.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
