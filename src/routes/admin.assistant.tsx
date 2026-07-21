import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { askAssistant } from "@/lib/ai-assistant.functions";
import { toast } from "sonner";
import { SectionTabs } from "@/components/admin/SectionTabs";

export const Route = createFileRoute("/admin/assistant")({
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "اقترح خطة شرح لدرس الجغرافيا للأسبوع القادم",
  "اكتب مراجعة سريعة على درس الحرب العالمية الأولى",
  "أنشئ 5 أسئلة MCQ عن حقوق المواطنة",
  "اقترح رسالة واتساب لولي أمر طالب متعثر",
];

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const askFn = useServerFn(askAssistant);

  const mut = useMutation({
    mutationFn: async (text: string) => {
      const next: Msg[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      const r = await askFn({ data: { messages: next } });
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الاتصال بالمساعد"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mut.isPending]);

  const send = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || mut.isPending) return;
    setInput("");
    mut.mutate(t);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <SectionTabs items={[{ to: "/admin/assistant", label: "المساعد الذكي" }, { to: "/admin/live", label: "اللوحة الحية" }]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">المساعد الذكي</h1>
            <p className="text-sm text-muted-foreground">مساعدك في التحضير، المراجعة، تحليل النتائج، وصياغة الرسائل</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setMessages([])}>
            <Trash2 className="h-4 w-4 ml-1" />محادثة جديدة
          </Button>
        )}
      </div>

      <Card className="h-[calc(100vh-16rem)] flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-12">
                <div className="h-16 w-16 rounded-full bg-primary/10 grid place-items-center">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">كيف أستطيع مساعدتك اليوم؟</h3>
                  <p className="text-sm text-muted-foreground mt-1">اختر أحد الاقتراحات أو اكتب سؤالك</p>
                </div>
                <div className="grid gap-2 w-full max-w-xl mt-4">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="text-right p-3 rounded-lg border hover:bg-muted transition text-sm"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div
                      className={`flex-1 rounded-2xl px-4 py-3 ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {mut.isPending && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted grid place-items-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">جاري التفكير...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-3 bg-background">
            <div className="max-w-3xl mx-auto flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="اكتب سؤالك هنا... (Shift+Enter لسطر جديد)"
                rows={2}
                className="resize-none"
                disabled={mut.isPending}
              />
              <Button onClick={() => send()} disabled={mut.isPending || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
