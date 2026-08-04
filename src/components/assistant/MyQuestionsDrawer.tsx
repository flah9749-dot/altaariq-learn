import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircleQuestion, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { myTeacherQuestions } from "@/lib/teacher-questions.functions";

/** Archive of the questions the student escalated to the teacher, with the answers. */
export function MyQuestionsDrawer() {
  const fn = useServerFn(myTeacherQuestions);
  const q = useQuery({
    queryKey: ["my-teacher-questions"],
    queryFn: async () => (await fn({ data: undefined as any })) as { questions: any[] },
  });

  const rows = q.data?.questions ?? [];
  const answered = rows.filter((r) => r.status === "answered").length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageCircleQuestion className="h-4 w-4 ml-1" />
          أسئلتي للمدرس
          {answered > 0 && <Badge className="mr-1 h-5 px-1.5 text-[10px]">{answered}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md" dir="rtl">
        <SheetHeader>
          <SheetTitle>أسئلتي وإجابات المدرس</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100dvh-6rem)] mt-4 pl-2">
          {q.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل...
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">لم ترسل أي سؤال للمدرس بعد.</p>
          ) : (
            <div className="space-y-3 pb-8">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{r.question}</p>
                    <Badge variant={r.status === "answered" ? "default" : "secondary"} className="shrink-0">
                      {r.status === "answered" ? "تمت الإجابة" : "بانتظار المدرس"}
                    </Badge>
                  </div>
                  {r.answer && (
                    <p className="text-sm bg-muted rounded-lg p-2 whitespace-pre-wrap">{r.answer}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ar-EG")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
