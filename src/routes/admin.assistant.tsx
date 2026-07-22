import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User, Loader2, Trash2, Paperclip, X, FileText, ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

type Attachment = {
  kind: "image" | "file";
  mime: string;
  name: string;
  dataUrl: string;
  size: number;
};

type Msg = { role: "user" | "assistant"; content: string; attachments?: Attachment[] };

const QUICK_PROMPTS = [
  "اقترح خطة شرح لدرس الجغرافيا للأسبوع القادم",
  "اكتب مراجعة سريعة على درس الحرب العالمية الأولى",
  "أنشئ 5 أسئلة MCQ عن حقوق المواطنة",
  "لخّص لي هذا الملف واستخرج أهم النقاط",
];

const MAX_FILE_MB = 50;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const askFn = useServerFn(askAssistant);

  const mut = useMutation({
    mutationFn: async ({ text, atts }: { text: string; atts: Attachment[] }) => {
      const userMsg: Msg = { role: "user", content: text, attachments: atts.length ? atts : undefined };
      const next: Msg[] = [...messages, userMsg];
      setMessages(next);
      const payload = next.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments?.map((a) => ({ kind: a.kind, mime: a.mime, name: a.name, dataUrl: a.dataUrl })),
      }));
      const r = await askFn({ data: { messages: payload } });
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الاتصال بالمساعد"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mut.isPending]);

  async function handleFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const arr: Attachment[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`الملف "${f.name}" أكبر من ${MAX_FILE_MB}MB`);
        continue;
      }
      const isImage = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf";
      if (!isImage && !isPdf) {
        toast.error(`نوع غير مدعوم: ${f.name} (الصور و PDF فقط)`);
        continue;
      }
      try {
        const dataUrl = await readAsDataUrl(f);
        arr.push({
          kind: isImage ? "image" : "file",
          mime: f.type,
          name: f.name,
          dataUrl,
          size: f.size,
        });
      } catch {
        toast.error(`فشل قراءة ${f.name}`);
      }
    }
    if (arr.length) setPending((p) => [...p, ...arr]);
    if (fileRef.current) fileRef.current.value = "";
  }

  const send = (text?: string) => {
    const t = (text ?? input).trim();
    if ((!t && pending.length === 0) || mut.isPending) return;
    setInput("");
    const atts = pending;
    setPending([]);
    mut.mutate({ text: t || "حلّل المرفق من فضلك", atts });
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
            <p className="text-sm text-muted-foreground">ارفع صورة أو PDF لتحليله، أو اسأل عن التحضير والمراجعة</p>
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
                  <p className="text-sm text-muted-foreground mt-1">اختر اقتراحًا أو ارفع ملفًا/صورة</p>
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
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {m.attachments.map((a, idx) =>
                            a.kind === "image" ? (
                              <img
                                key={idx}
                                src={a.dataUrl}
                                alt={a.name}
                                className="max-h-40 rounded-lg border"
                              />
                            ) : (
                              <div
                                key={idx}
                                className="flex items-center gap-2 rounded-lg border bg-background/60 px-2 py-1 text-xs text-foreground"
                              >
                                <FileText className="h-4 w-4" />
                                <span className="truncate max-w-[180px]">{a.name}</span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        m.content && <p className="whitespace-pre-wrap">{m.content}</p>
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
            <div className="max-w-3xl mx-auto space-y-2">
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pending.map((a, idx) => (
                    <div
                      key={idx}
                      className="relative flex items-center gap-2 rounded-lg border bg-muted/50 pr-2 pl-1 py-1 text-xs"
                    >
                      {a.kind === "image" ? (
                        <img src={a.dataUrl} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-background grid place-items-center">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                      <span className="truncate max-w-[160px]">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setPending((p) => p.filter((_, i) => i !== idx))}
                        className="mr-1 rounded-full hover:bg-destructive/10 p-1"
                        aria-label="إزالة"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => fileRef.current?.click()}
                  disabled={mut.isPending}
                  title="إرفاق صورة أو PDF"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="اكتب سؤالك أو ارفق ملفًا... (Shift+Enter لسطر جديد)"
                  rows={2}
                  className="resize-none"
                  disabled={mut.isPending}
                />
                <Button
                  onClick={() => send()}
                  disabled={mut.isPending || (!input.trim() && pending.length === 0)}
                  size="icon"
                  className="h-11 w-11 shrink-0"
                >
                  {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                <ImageIcon className="inline h-3 w-3 ml-1" />
                صور و PDF مدعومة — أقصى حجم {MAX_FILE_MB}MB لكل ملف
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
