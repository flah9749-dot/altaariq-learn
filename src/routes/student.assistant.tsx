import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Bot, Send, Sparkles, User, Loader2, Trash2, Paperclip, X, FileText, Image as ImageIcon,
  BookOpen, HelpCircle, Baby, ScrollText, ListTree, Network, MessageCircleQuestion,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { askStudentAssistant } from "@/lib/student-assistant.functions";
import { askTeacher } from "@/lib/teacher-questions.functions";
import { ArchiveDrawer } from "@/components/assistant/ArchiveDrawer";
import { upsertSession } from "@/lib/assistant-archive";
import { useAuth } from "@/lib/auth-context";


export const Route = createFileRoute("/student/assistant")({
  component: StudentAssistantPage,
});

type Attach = { kind: "image" | "pdf"; name: string; data_url: string; size: number };
type Source = { title: string; unit: string | null; lesson: string | null; page: number | null; similarity: number };
type Msg = {
  role: "user" | "assistant";
  content: string;
  files?: string[];
  sources?: Source[];
  needsTeacher?: boolean;
};

const QUICK_PROMPTS = [
  "لخّص لي درس اليوم في نقاط",
  "اشرح لي مفهوم المواطنة ببساطة",
  "أعطني 5 أسئلة مراجعة عن الحرب العالمية الأولى",
  "ساعدني أفهم خرائط الجغرافيا",
];

type StyleKey = "normal" | "simple" | "very_simple" | "story" | "qa" | "outline" | "mindmap";

const STYLES: { key: StyleKey; label: string; icon: any }[] = [
  { key: "simple", label: "بسّطها", icon: Sparkles },
  { key: "very_simple", label: "بسّطها جدًا", icon: Baby },
  { key: "story", label: "في شكل حكاية", icon: ScrollText },
  { key: "qa", label: "سؤال وجواب", icon: HelpCircle },
  { key: "outline", label: "مخطط منظّم", icon: ListTree },
  { key: "mindmap", label: "خريطة ذهنية", icon: Network },
];

const MAX_MB = 50;


function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

async function prepareAttachmentFile(file: File): Promise<File | Blob> {
  if (!file.type.startsWith("image/")) return file;
  const { compressImage } = await import("@/lib/message-utils");
  return compressImage(file, 1800, 0.84);
}

function StudentAssistantPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [archiveTick, setArchiveTick] = useState(0);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attach[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const askFn = useServerFn(askStudentAssistant);
  const askTeacherFn = useServerFn(askTeacher);
  const [askedTeacher, setAskedTeacher] = useState<Record<number, boolean>>({});

  const mut = useMutation({
    mutationFn: async ({ text, atts, style }: { text: string; atts: Attach[]; style?: StyleKey }) => {
      const userMsg: Msg = { role: "user", content: text, files: atts.map((a) => a.name) };
      const next: Msg[] = [...messages, userMsg];
      setMessages(next);
      const r = await askFn({
        data: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          attachments: atts.map((a) => ({ kind: a.kind, name: a.name, data_url: a.data_url })),
          style: style ?? "normal",
        },
      });
      const finalMsgs: Msg[] = [
        ...next,
        { role: "assistant", content: r.reply, sources: (r as any).sources ?? [], needsTeacher: !!(r as any).needsTeacher },
      ];
      setMessages(finalMsgs);
      const saved = upsertSession(
        "student",
        userId,
        sessionId,
        finalMsgs.map((m) => ({ role: m.role, content: m.content, files: m.files })),
      );
      if (saved) {
        setSessionId(saved.id);
        setArchiveTick((t) => t + 1);
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الاتصال بالمساعد"),
  });

  const teacherMut = useMutation({
    mutationFn: async ({ index }: { index: number }) => {
      const question = [...messages].slice(0, index).reverse().find((m) => m.role === "user")?.content ?? "";
      if (!question) throw new Error("لم يُعثر على السؤال");
      await askTeacherFn({ data: { question, aiDraft: messages[index]?.content ?? null } });
      setAskedTeacher((p) => ({ ...p, [index]: true }));
    },
    onSuccess: () => toast.success("تم إرسال سؤالك للمدرس — سيصلك الرد قريبًا"),
    onError: (e: any) => toast.error(e?.message ?? "تعذّر إرسال السؤال"),
  });

  const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";



  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mut.isPending]);

  const onPickFiles = async (list: FileList | null) => {
    if (!list) return;
    const out: Attach[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name}: الحجم أكبر من ${MAX_MB}MB`); continue; }
      const isImg = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf";
      if (!isImg && !isPdf) { toast.error(`${f.name}: نوع الملف غير مدعوم (صور أو PDF فقط)`); continue; }
      const prepared = await prepareAttachmentFile(f);
      const data_url = await fileToDataUrl(prepared instanceof File ? prepared : new File([prepared], f.name, { type: "image/jpeg" }));
      out.push({ kind: isImg ? "image" : "pdf", name: f.name, data_url, size: f.size });
    }
    setAttachments((prev) => [...prev, ...out]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = (text?: string, style?: StyleKey) => {
    const t = (text ?? input).trim();
    if ((!t && attachments.length === 0) || mut.isPending) return;
    const finalText = t || "لخّص لي هذا الملف واشرح أهم النقاط.";
    if (text === undefined) setInput("");
    const atts = attachments;
    setAttachments([]);
    mut.mutate({ text: finalText, atts, style });
  };

  const reformat = (style: StyleKey) => {
    if (!lastUserText || mut.isPending) return;
    send(lastUserText, style);
  };


  return (
    <div className="max-w-4xl mx-auto space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">المساعد الذكي</h1>
            <p className="text-sm text-muted-foreground">ارفع ملخص أو ملف PDF واطلب شرحًا أو تلخيصًا</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ArchiveDrawer
            scope="student"
            userId={userId}
            activeId={sessionId}
            refreshKey={archiveTick}
            onOpenSession={(s) => {
              setMessages(
                s.messages.map((m) => ({ role: m.role, content: m.content, files: m.files })),
              );
              setSessionId(s.id);
            }}
          />
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMessages([]);
                setSessionId(null);
              }}
            >
              <Trash2 className="h-4 w-4 ml-1" />محادثة جديدة
            </Button>
          )}
        </div>

      </div>

      <Card className="h-[calc(100vh-14rem)] flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-12">
                <div className="h-16 w-16 rounded-full bg-primary/10 grid place-items-center">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">أهلاً بك! كيف أقدر أساعدك؟</h3>
                  <p className="text-sm text-muted-foreground mt-1">اسأل عن أي درس، أو ارفع ملف PDF/صورة لأشرحه لك</p>
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
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={`flex-1 rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.files && m.files.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {m.files.map((n, k) => (
                            <span key={k} className="inline-flex items-center gap-1 text-xs bg-background/20 rounded px-2 py-0.5">
                              <FileText className="h-3 w-3" /> {n}
                            </span>
                          ))}
                        </div>
                      )}
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

          <div className="border-t p-3 bg-background space-y-2">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1 text-xs">
                    {a.kind === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    <span className="max-w-[150px] truncate">{a.name}</span>
                    <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="hover:text-destructive">
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
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => fileRef.current?.click()} disabled={mut.isPending} title="إرفاق ملف">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="اكتب سؤالك أو ارفع ملف... (Shift+Enter لسطر جديد)"
                rows={2}
                className="resize-none"
                disabled={mut.isPending}
              />
              <Button onClick={() => send()} disabled={mut.isPending || (!input.trim() && attachments.length === 0)} size="icon" className="h-11 w-11 shrink-0">
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
