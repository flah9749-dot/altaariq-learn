import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Sparkles, Upload, X, Loader2, Camera, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateExamWithAI } from "@/lib/ai-exam.functions";
import { upsertExam, saveQuestions } from "@/lib/exams.functions";
import { QUESTION_TYPES } from "@/lib/exam-utils";

export const Route = createFileRoute("/admin/exams/ai")({
  head: () => ({ meta: [{ title: "إنشاء امتحان بالذكاء الاصطناعي" }] }),
  component: AIExamPage,
});

type Attachment = { kind: "image" | "pdf"; name: string; data_url: string };

const readFile = (file: File): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });

async function prepareAttachmentFile(file: File): Promise<File | Blob> {
  if (!file.type.startsWith("image/")) return file;
  const { compressImage } = await import("@/lib/message-utils");
  return compressImage(file, 1800, 0.84);
}

function AIExamPage() {
  const nav = useNavigate();
  const genFn = useServerFn(generateExamWithAI);
  const upsertFn = useServerFn(upsertExam);
  const saveQFn = useServerFn(saveQuestions);

  const [topic, setTopic] = useState("");
  const [rawText, setRawText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [numQuestions, setNumQ] = useState(10);
  const [types, setTypes] = useState<string[]>(["mcq"]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [pts, setPts] = useState(1);
  const [useTotal, setUseTotal] = useState(false);
  const [totalScore, setTotalScore] = useState(50);
  const [preview, setPreview] = useState<{ title: string; questions: any[] } | null>(null);
  const [fileProgress, setFileProgress] = useState<{ name: string; index: number; total: number } | null>(null);

  const uploadFile = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    for (let index = 0; index < list.length; index++) {
      const f = list[index];
      if (f.size > 50 * 1024 * 1024) { toast.error(`${f.name}: الحجم أكبر من 50MB`); continue; }
      const isPdf = f.type === "application/pdf";
      const isImg = f.type.startsWith("image/");
      if (!isPdf && !isImg) { toast.error(`${f.name}: النوع غير مدعوم`); continue; }
      setFileProgress({ name: f.name, index: index + 1, total: list.length });
      const prepared = await prepareAttachmentFile(f);
      const url = await readFile(prepared instanceof File ? prepared : new File([prepared], f.name, { type: "image/jpeg" }));
      setAttachments((a) => [...a, { kind: isPdf ? "pdf" : "image", name: f.name, data_url: url }]);
    }
    setFileProgress(null);
  };

  const toggleType = (v: string) => setTypes((t) => t.includes(v) ? t.filter((x) => x !== v) : [...t, v]);

  const genMut = useMutation({
    mutationFn: async () => genFn({ data: {
      topic, raw_text: rawText, attachments, num_questions: numQuestions,
      question_types: types, difficulty, language, points_per_question: pts,
      total_score: useTotal ? totalScore : null,
    } }),
    onSuccess: (r: any) => { setPreview(r); toast.success(`تم توليد ${r.questions.length} سؤال`); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التوليد"),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("لا يوجد أسئلة");
      const created = await upsertFn({ data: { patch: { title: preview.title, subject: null, published: false, status: "draft" } } }) as any;
      await saveQFn({ data: { exam_id: created.id, questions: preview.questions } });
      await upsertFn({ data: { id: created.id, patch: { published: true, status: "published" } } });
      return created.id;
    },
    onSuccess: (id: string) => { toast.success("تم إنشاء الامتحان"); nav({ to: "/admin/exams/$id", params: { id } }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  const editInEditor = async () => {
    if (!preview) return;
    const created = await upsertFn({ data: { patch: { title: preview.title } } }) as any;
    sessionStorage.setItem(`ai-exam-draft-${created.id}`, JSON.stringify(preview));
    nav({ to: "/admin/exams/$id", params: { id: created.id } });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/admin/exams" })}>
          <ArrowRight className="h-4 w-4 ml-1" />العودة
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />إنشاء امتحان بالذكاء الاصطناعي
        </h1>
      </div>

      {!preview ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">المصدر</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field label="الموضوع / العنوان">
                  <Input placeholder="مثال: الحرب العالمية الثانية — أسبابها ونتائجها" value={topic} onChange={(e) => setTopic(e.target.value)} />
                </Field>
                <Field label="نص مرجعي (اختياري)">
                  <Textarea rows={6} placeholder="ألصق نصًا مرجعيًا لتوليد أسئلة منه..." value={rawText} onChange={(e) => setRawText(e.target.value)} />
                </Field>
                <Field label="المرفقات (PDF, صور — OCR تلقائي)">
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" disabled={!!fileProgress}>
                      <label className="cursor-pointer"><Upload className="h-4 w-4 ml-1" />رفع ملف
                        <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => uploadFile(e.target.files)} />
                      </label>
                    </Button>
                    <Button asChild size="sm" variant="outline" disabled={!!fileProgress}>
                      <label className="cursor-pointer"><Camera className="h-4 w-4 ml-1" />التقاط صورة
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => uploadFile(e.target.files)} />
                      </label>
                    </Button>
                  </div>
                  {fileProgress && (
                    <p className="text-xs text-primary flex items-center gap-1 mt-2">
                      <Loader2 className="h-3 w-3 animate-spin" />جارٍ تجهيز الملف {fileProgress.index}/{fileProgress.total}: {fileProgress.name}
                    </p>
                  )}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {attachments.map((a, i) => (
                        <Badge key={i} variant="secondary" className="gap-2">
                          <FileText className="h-3 w-3" />{a.name}
                          <button onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </Field>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">إعدادات التوليد</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field label="عدد الأسئلة"><Input type="number" min={1} max={50} value={numQuestions} onChange={(e) => setNumQ(Number(e.target.value))} /></Field>
                <Field label="أنواع الأسئلة">
                  <div className="space-y-1.5">
                    {QUESTION_TYPES.map((t) => (
                      <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={types.includes(t.value)} onCheckedChange={() => toggleType(t.value)} />
                        <span>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="مستوى الصعوبة">
                  <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">سهل</SelectItem>
                      <SelectItem value="medium">متوسط</SelectItem>
                      <SelectItem value="hard">صعب</SelectItem>
                      <SelectItem value="mixed">مختلط</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="لغة الامتحان">
                  <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ar">العربية</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="طريقة توزيع الدرجات">
                  <div className="rounded-lg border p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={!useTotal} onChange={() => setUseTotal(false)} />
                      <span>درجة ثابتة لكل سؤال</span>
                    </label>
                    {!useTotal && (
                      <Input type="number" step="0.5" min={0.5} value={pts} onChange={(e) => setPts(Number(e.target.value))} />
                    )}
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={useTotal} onChange={() => setUseTotal(true)} />
                      <span>الدرجة الكلية للامتحان (يوزّعها الذكاء الاصطناعي)</span>
                    </label>
                    {useTotal && (
                      <Input type="number" min={1} value={totalScore} onChange={(e) => setTotalScore(Number(e.target.value))} placeholder="مثال: 50" />
                    )}
                  </div>
                </Field>
                <Button className="w-full" onClick={() => genMut.mutate()} disabled={!!fileProgress || genMut.isPending || (!topic && !rawText && attachments.length === 0) || types.length === 0}>
                  {genMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin ml-1" />جاري التوليد...</> : <><Sparkles className="h-4 w-4 ml-1" />توليد الامتحان</>}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>مراجعة الامتحان: {preview.title}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPreview(null)}>إعادة التوليد</Button>
                <Button variant="outline" onClick={editInEditor}>تعديل في المحرر</Button>
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                  {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ وفتح
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {preview.questions.map((q: any, i: number) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge>{i + 1}</Badge>
                    <Badge variant="outline">{QUESTION_TYPES.find((t) => t.value === q.type)?.label ?? q.type}</Badge>
                    {q.difficulty && <Badge variant="secondary">{q.difficulty}</Badge>}
                    <span className="text-xs text-muted-foreground mr-auto">{q.points} درجة</span>
                  </div>
                  <p className="font-medium">{q.text}</p>
                  {q.options?.length > 0 && (
                    <ul className="space-y-1 text-sm">
                      {q.options.map((o: any, oi: number) => (
                        <li key={oi} className={`flex items-center gap-2 ${o.is_correct ? "text-success font-medium" : "text-muted-foreground"}`}>
                          {o.is_correct ? "✓" : "○"} {o.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.correct_answer != null && !q.options?.length && (
                    <p className="text-sm text-success">الإجابة: {typeof q.correct_answer === "object" ? JSON.stringify(q.correct_answer) : String(q.correct_answer)}</p>
                  )}
                  {q.explanation && <p className="text-xs text-muted-foreground border-t pt-2">{q.explanation}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
