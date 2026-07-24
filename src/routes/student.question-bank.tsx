import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listQuestionBank } from "@/lib/question-bank.functions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Image as ImageIcon, Video, Search, BookOpen } from "lucide-react";

export const Route = createFileRoute("/student/question-bank")({
  head: () => ({ meta: [
    { title: "بنك الأسئلة والمواد — الطارق التعليمية" },
    { name: "description", content: "أسئلة تدريبية ومواد مرجعية في الدراسات الاجتماعية." },
  ] }),
  component: StudentBankPage,
});

const SUBJECTS = [
  { v: "all", l: "الكل" },
  { v: "general", l: "عام" },
  { v: "history", l: "تاريخ" },
  { v: "geography", l: "جغرافيا" },
  { v: "citizenship", l: "مواطنة" },
];

function StudentBankPage() {
  const list = useServerFn(listQuestionBank);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState("all");

  const q = useQuery({
    queryKey: ["student-question-bank", { search, subject, type }],
    queryFn: () => list({ data: { search, subject, entry_type: type } }),
  });

  const items = q.data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" /> بنك الأسئلة والمواد
        </h1>
        <p className="text-sm text-muted-foreground">أسئلة تدريبية ومواد مرجعية أضافها معلمك</p>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-8" />
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="question">أسئلة</SelectItem>
              <SelectItem value="material">مواد</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {q.isLoading && <div className="text-center text-muted-foreground py-8">جارٍ التحميل…</div>}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((e) => {
          const c: any = e.content ?? {};
          return (
            <Card key={e.id}>
              <CardHeader className="p-3 pb-2">
                <div className="flex flex-wrap gap-1 mb-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {e.entry_type === "material" ? "مادة مرجعية" : e.question_type ?? "سؤال"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {SUBJECTS.find((s) => s.v === e.subject)?.l ?? e.subject}
                  </Badge>
                </div>
                <CardTitle className="text-sm">{e.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                {e.entry_type === "material" && c.body && (
                  <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                )}
                {e.entry_type === "question" && c.text && (
                  <div className="text-sm">
                    <p className="font-medium">{c.text}</p>
                    {Array.isArray(c.options) && (
                      <ul className="mt-2 space-y-1">
                        {c.options.map((o: any, i: number) => (
                          <li key={i} className="text-xs bg-muted rounded px-2 py-1">{o.text}</li>
                        ))}
                      </ul>
                    )}
                    {c.correct_answer && (
                      <details className="mt-2">
                        <summary className="text-xs text-primary cursor-pointer">إظهار الإجابة</summary>
                        <p className="text-xs mt-1 p-2 bg-green-50 dark:bg-green-950 rounded">{c.correct_answer}</p>
                        {c.explanation && <p className="text-xs mt-1 text-muted-foreground">{c.explanation}</p>}
                      </details>
                    )}
                  </div>
                )}
                {e.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t">
                    {e.attachments.map((a, i) => (
                      <a key={i} href={a.url ?? "#"} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] bg-primary/10 text-primary rounded px-2 py-1 hover:bg-primary/20">
                        {a.mime?.startsWith("image/") ? <ImageIcon className="w-3 h-3" /> :
                         a.mime?.startsWith("video/") ? <Video className="w-3 h-3" /> :
                         <FileText className="w-3 h-3" />}
                        <span className="truncate max-w-[140px]">{a.name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!q.isLoading && items.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              لا توجد عناصر متاحة بعد.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
