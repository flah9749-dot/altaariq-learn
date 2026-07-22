import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight, Save, Plus, Trash2, GripVertical, CheckCircle2, XCircle,
  Sparkles, Settings2, FileText, ImagePlus, MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertExam, saveQuestions, publishExam } from "@/lib/exams.functions";
import { generateInteractiveMap } from "@/lib/ai-map.functions";
import { listMapTemplates, upsertMapTemplate } from "@/lib/map-templates.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { QUESTION_TYPES, type QuestionType, type MapSubQuestion } from "@/lib/exam-utils";
import { MapPointQuestions } from "@/components/exams/MapPointQuestions";

export const Route = createFileRoute("/admin/exams/$id")({
  head: () => ({ meta: [
    { title: "تعديل الامتحان — الطارق التعليمية" },
    { name: "description", content: "تحرير إعدادات وأسئلة امتحانات منصة الطارق التعليمية." },
    { property: "og:title", content: "تعديل الامتحان — الطارق التعليمية" },
    { property: "og:description", content: "تحرير إعدادات وأسئلة امتحانات منصة الطارق التعليمية." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ExamEditor,
});

type Q = {
  id?: string;
  type: string;
  text: string;
  points: number;
  suggested_time_sec?: number | null;
  explanation?: string | null;
  difficulty?: string | null;
  image_url?: string | null;
  correct_answer?: any;
  options: Array<{ text: string; is_correct: boolean; order_index: number; match_key?: string | null }>;
};

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
function localInputToIso(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

function makeBlank(type: QuestionType = "mcq"): Q {
  const base: Q = { type, text: "", points: 1, options: [] };
  if (type === "mcq") base.options = [
    { text: "", is_correct: true, order_index: 0 },
    { text: "", is_correct: false, order_index: 1 },
    { text: "", is_correct: false, order_index: 2 },
    { text: "", is_correct: false, order_index: 3 },
  ];
  if (type === "true_false") base.correct_answer = "true";
  if (type === "complete") base.correct_answer = "";
  if (type === "order") base.options = [{ text: "", is_correct: false, order_index: 0 }];
  if (type === "match") base.options = [{ text: "", is_correct: false, order_index: 0, match_key: "أ" }];
  if (type === "map") base.correct_answer = { points: [{ label: "الموقع الصحيح", prompt: "", x: 50, y: 50 }] };
  return base;
}

type MapPoint = { label: string; prompt?: string; x: number; y: number; questions?: MapSubQuestion[] };

const getMapPoints = (answer: any): MapPoint[] => {
  const raw = Array.isArray(answer?.points) ? answer.points : Array.isArray(answer) ? answer : [];
  return raw.length ? raw.map((p: any) => ({
    label: String(p?.label ?? ""),
    prompt: typeof p?.prompt === "string" ? p.prompt : "",
    x: Math.max(0, Math.min(100, Number(p?.x ?? 50))),
    y: Math.max(0, Math.min(100, Number(p?.y ?? 50))),
    questions: Array.isArray(p?.questions) ? p.questions : undefined,
  })) : [];
};

const setMapPoint = (answer: any, index: number, patch: Partial<MapPoint>) => {
  const points = getMapPoints(answer).map((p, i) => i === index ? { ...p, ...patch } : p);
  return { points };
};

const addMapPoint = (answer: any, x = 50, y = 50) => {
  const points = getMapPoints(answer);
  const idx = points.length + 1;
  return { points: [...points, { label: `الموقع ${idx}`, prompt: "", x, y }] };
};

const removeMapPoint = (answer: any, index: number) => {
  const points = getMapPoints(answer).filter((_, i) => i !== index);
  return { points: points.length ? points : [{ label: "الموقع الصحيح", prompt: "", x: 50, y: 50 }] };
}

async function prepareQuestionImage(file: File): Promise<File | Blob> {
  const { compressImage } = await import("@/lib/message-utils");
  return compressImage(file, 1800, 0.84);
}

const readImage = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function ExamEditor() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertExam);
  const saveQFn = useServerFn(saveQuestions);
  const pubFn = useServerFn(publishExam);
  const aiMapFn = useServerFn(generateInteractiveMap);
  const listTplFn = useServerFn(listMapTemplates);
  const saveTplFn = useServerFn(upsertMapTemplate);

  const [meta, setMeta] = useState<any | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [aiMapDlg, setAiMapDlg] = useState<{ open: boolean; qi: number; topic: string; num: number; busy: boolean }>({ open: false, qi: -1, topic: "", num: 6, busy: false });
  const [libDlg, setLibDlg] = useState<{ open: boolean; qi: number }>({ open: false, qi: -1 });
  const [libItems, setLibItems] = useState<any[] | null>(null);
  const loadedAiDraft = useRef(false);

  const { data: exam, isLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: async () => {
      const { data } = await supabase.from("exams").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });
  const { data: dbQuestions } = useQuery({
    queryKey: ["exam-questions", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("admin_get_exam_questions", { _exam_id: id });
      return (data as any[]) ?? [];
    },
  });
  const { data: classes } = useQuery({
    queryKey: ["classes-list"], queryFn: async () => (await supabase.from("classes").select("id,name")).data ?? [],
  });

  useEffect(() => { if (exam) setMeta(exam); }, [exam]);
  useEffect(() => {
    if (dbQuestions && !loadedAiDraft.current) {
      setQuestions(dbQuestions.map((q: any) => ({
        id: q.id, type: q.type, text: q.text, points: Number(q.points) || 1,
        suggested_time_sec: q.suggested_time_sec, explanation: q.explanation,
        difficulty: q.difficulty, image_url: q.image_url, correct_answer: q.correct_answer,
        options: (q.question_options ?? []).sort((a: any, b: any) => a.order_index - b.order_index).map((o: any) => ({
          text: o.text, is_correct: o.is_correct, order_index: o.order_index, match_key: o.match_key,
        })),
      })));
    }
  }, [dbQuestions]);

  // Import from AI navigation state
  useEffect(() => {
    try {
      const key = `ai-exam-draft-${id}`;
      const draft = sessionStorage.getItem(key);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (Array.isArray(parsed.questions) && parsed.questions.length) {
          setQuestions(parsed.questions);
          loadedAiDraft.current = true;
          if (parsed.title) setMeta((m: any) => ({ ...m, title: parsed.title }));
          sessionStorage.removeItem(key);
          toast.success(`تم استيراد ${parsed.questions.length} سؤال من الذكاء الاصطناعي`);
        }
      }
    } catch {}
  }, [id]);

  const setM = (k: string, v: any) => setMeta((p: any) => ({ ...p, [k]: v }));
  const setAC = (k: string, v: boolean) => setMeta((p: any) => ({ ...p, anti_cheat: { ...(p.anti_cheat ?? {}), [k]: v } }));

  const addQ = (type: QuestionType) => setQuestions((qs) => [...qs, makeBlank(type)]);
  const removeQ = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  const updateQ = (i: number, patch: Partial<Q>) => setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  const moveQ = (i: number, dir: -1 | 1) => setQuestions((qs) => {
    const n = [...qs]; const t = n[i + dir]; if (!t) return qs; n[i + dir] = n[i]; n[i] = t; return n;
  });

  const saveMeta = useMutation({
    mutationFn: async () => upsertFn({ data: { id, patch: {
      title: meta.title, description: meta.description, subject: meta.subject,
      class_id: meta.class_id, group_ids: meta.group_ids ?? [],
      duration_minutes: meta.duration_minutes, attempts_allowed: meta.attempts_allowed,
      show_result_mode: meta.show_result_mode, shuffle_questions: meta.shuffle_questions,
      shuffle_options: meta.shuffle_options, num_variants: meta.num_variants,
      starts_at: meta.starts_at || null, ends_at: meta.ends_at || null,
      anti_cheat: meta.anti_cheat ?? {},
    } } }),
    onSuccess: () => { toast.success("تم حفظ الإعدادات"); qc.invalidateQueries({ queryKey: ["exam", id] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  const saveQs = useMutation({
    mutationFn: async () => saveQFn({ data: { exam_id: id, questions } }),
    onSuccess: (r: any) => {
      loadedAiDraft.current = false;
      toast.success(`تم حفظ ${r.count} سؤال (الدرجة الكلية: ${r.total_score})`);
      qc.invalidateQueries({ queryKey: ["exam", id] });
      qc.invalidateQueries({ queryKey: ["exam-questions", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  const publish = useMutation({
    mutationFn: async () => pubFn({ data: { id, published: !meta.published } }),
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["exam", id] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التحديث"),
  });

  if (isLoading || !meta) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/admin/exams" })}>
          <ArrowRight className="h-4 w-4 ml-1" />القائمة
        </Button>
        <div className="mr-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            const { exportExamToPdf } = await import("@/lib/exam-pdf");
            await exportExamToPdf({ title: meta.title ?? "امتحان", subtitle: meta.subject ?? undefined, questions: questions as any, showAnswers: false });
          }} disabled={questions.length === 0}>
            <FileText className="h-4 w-4 ml-1" />PDF للطباعة
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            const { exportExamToPdf } = await import("@/lib/exam-pdf");
            await exportExamToPdf({ title: meta.title ?? "امتحان", subtitle: meta.subject ?? undefined, questions: questions as any, showAnswers: true });
          }} disabled={questions.length === 0}>
            <FileText className="h-4 w-4 ml-1" />نموذج الإجابة
          </Button>
          <Button variant={meta.published ? "outline" : "default"} size="sm" onClick={() => publish.mutate()}>
            {meta.published ? <><XCircle className="h-4 w-4 ml-1" />إلغاء النشر</> : <><CheckCircle2 className="h-4 w-4 ml-1" />نشر</>}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="questions">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="questions"><FileText className="h-4 w-4 ml-1" />الأسئلة ({questions.length})</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="h-4 w-4 ml-1" />الإعدادات</TabsTrigger>
          <TabsTrigger value="anticheat"><Sparkles className="h-4 w-4 ml-1" />مكافحة الغش</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((t) => (
              <Button key={t.value} size="sm" variant="outline" onClick={() => addQ(t.value as QuestionType)}>
                <Plus className="h-3 w-3 ml-1" />{t.label}
              </Button>
            ))}
            <div className="mr-auto"><Button size="sm" onClick={() => saveQs.mutate()} disabled={saveQs.isPending}><Save className="h-4 w-4 ml-1" />حفظ الأسئلة</Button></div>
          </div>

          {questions.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              لا يوجد أسئلة بعد. أضف سؤالًا يدويًا أو <Link to="/admin/exams/ai" className="text-primary underline">استخدم الذكاء الاصطناعي</Link>.
            </CardContent></Card>
          ) : questions.map((q, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <Badge variant="outline">{i + 1}</Badge>
                  <Select value={q.type} onValueChange={(v) => updateQ(i, { ...makeBlank(v as QuestionType), text: q.text, points: q.points, image_url: v === "map" ? q.image_url : undefined })}>
                    <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{QUESTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 text-xs">
                    <Label>الدرجة:</Label>
                    <Input type="number" step="0.5" value={q.points} onChange={(e) => updateQ(i, { points: Number(e.target.value) })} className="w-20 h-8" />
                  </div>
                  <div className="mr-auto flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => moveQ(i, -1)} disabled={i === 0}>↑</Button>
                    <Button size="icon" variant="ghost" onClick={() => moveQ(i, 1)} disabled={i === questions.length - 1}>↓</Button>
                    <Button size="icon" variant="ghost" onClick={() => removeQ(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea placeholder="نص السؤال..." value={q.text} onChange={(e) => updateQ(i, { text: e.target.value })} rows={2} />

                {q.type === "mcq" && (
                  <div className="space-y-2">
                    {q.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <Switch checked={o.is_correct} onCheckedChange={(v) => updateQ(i, { options: q.options.map((x, xi) => xi === oi ? { ...x, is_correct: v } : x) })} />
                        <Input value={o.text} onChange={(e) => updateQ(i, { options: q.options.map((x, xi) => xi === oi ? { ...x, text: e.target.value } : x) })} placeholder={`الاختيار ${oi + 1}`} />
                        <Button size="icon" variant="ghost" onClick={() => updateQ(i, { options: q.options.filter((_, xi) => xi !== oi) })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => updateQ(i, { options: [...q.options, { text: "", is_correct: false, order_index: q.options.length }] })}><Plus className="h-3 w-3 ml-1" />إضافة اختيار</Button>
                  </div>
                )}

                {q.type === "true_false" && (
                  <Select value={String(q.correct_answer ?? "true")} onValueChange={(v) => updateQ(i, { correct_answer: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="true">صح</SelectItem><SelectItem value="false">خطأ</SelectItem></SelectContent>
                  </Select>
                )}

                {q.type === "complete" && (
                  <Input placeholder="الإجابة الصحيحة" value={String(q.correct_answer ?? "")} onChange={(e) => updateQ(i, { correct_answer: e.target.value })} />
                )}

                {q.type === "order" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">أدخل العناصر بترتيبها الصحيح</p>
                    {q.options.map((o, oi) => (
                      <div key={oi} className="flex gap-2">
                        <Badge variant="outline">{oi + 1}</Badge>
                        <Input value={o.text} onChange={(e) => updateQ(i, { options: q.options.map((x, xi) => xi === oi ? { ...x, text: e.target.value } : x) })} />
                        <Button size="icon" variant="ghost" onClick={() => updateQ(i, { options: q.options.filter((_, xi) => xi !== oi) })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => {
                      const next = [...q.options, { text: "", is_correct: false, order_index: q.options.length }];
                      updateQ(i, { options: next, correct_answer: next.map((n) => n.text) });
                    }}><Plus className="h-3 w-3 ml-1" />إضافة عنصر</Button>
                  </div>
                )}

                {q.type === "match" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">أدخل أزواج (المفتاح ← القيمة)</p>
                    {q.options.map((o, oi) => (
                      <div key={oi} className="flex gap-2">
                        <Input placeholder="العمود الأول" value={o.match_key ?? ""} onChange={(e) => updateQ(i, { options: q.options.map((x, xi) => xi === oi ? { ...x, match_key: e.target.value } : x) })} className="w-32" />
                        <Input placeholder="العمود الثاني" value={o.text} onChange={(e) => updateQ(i, { options: q.options.map((x, xi) => xi === oi ? { ...x, text: e.target.value } : x) })} />
                        <Button size="icon" variant="ghost" onClick={() => updateQ(i, { options: q.options.filter((_, xi) => xi !== oi) })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => {
                      const next = [...q.options, { text: "", is_correct: false, order_index: q.options.length, match_key: "" }];
                      const ca: Record<string, string> = {};
                      next.forEach((x) => { if (x.match_key) ca[x.match_key] = x.text; });
                      updateQ(i, { options: next, correct_answer: ca });
                    }}><Plus className="h-3 w-3 ml-1" />إضافة زوج</Button>
                  </div>
                )}

                {q.type === "essay" && (
                  <p className="text-xs text-muted-foreground">سؤال مقالي — يتم تصحيحه يدويًا أو بمساعدة الذكاء الاصطناعي.</p>
                )}

                {q.type === "map" && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex flex-wrap gap-2 pb-2 border-b">
                      <Button size="sm" variant="secondary" onClick={() => setAiMapDlg({ open: true, qi: i, topic: q.text || "", num: 6, busy: false })}>
                        <Sparkles className="h-4 w-4 ml-1" />توليد الخريطة بالذكاء الاصطناعي
                      </Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        setLibDlg({ open: true, qi: i });
                        if (!libItems) { try { const items = await listTplFn(); setLibItems(items as any[]); } catch { setLibItems([]); } }
                      }}>
                        <MapPin className="h-4 w-4 ml-1" />من المكتبة
                      </Button>
                      <Button size="sm" variant="ghost" disabled={!q.image_url} onClick={async () => {
                        const title = window.prompt("عنوان القالب:", q.text || "قالب خريطة");
                        if (!title?.trim()) return;
                        try {
                          await saveTplFn({ data: {
                            title: title.trim(), image_url: q.image_url!, category: null, description: null,
                            points: getMapPoints(q.correct_answer),
                          } });
                          toast.success("تم الحفظ في المكتبة");
                          setLibItems(null);
                        } catch (e: any) { toast.error(e?.message ?? "فشل الحفظ"); }
                      }}>
                        <Save className="h-4 w-4 ml-1" />حفظ في المكتبة
                      </Button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="رابط صورة الخريطة أو ارفع صورة"
                        value={q.image_url ?? ""}
                        onChange={(e) => updateQ(i, { image_url: e.target.value })}
                      />
                      <Button asChild variant="outline">
                        <label className="cursor-pointer">
                          <ImagePlus className="h-4 w-4 ml-1" />رفع خريطة
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const input = e.currentTarget;
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 50 * 1024 * 1024) { toast.error("حجم الصورة أكبر من 50MB"); return; }
                              try {
                                const prepared = await prepareQuestionImage(file);
                                const dataUrl = await readImage(prepared instanceof File ? prepared : new File([prepared], file.name, { type: "image/jpeg" }));
                                updateQ(i, { image_url: dataUrl });
                              } catch {
                                toast.error("فشل تجهيز صورة الخريطة");
                              } finally {
                                input.value = "";
                              }
                            }}
                          />
                        </label>
                      </Button>
                    </div>
                    {q.image_url ? (
                      <MapTargetEditor
                        imageUrl={q.image_url}
                        points={getMapPoints(q.correct_answer)}
                        onPick={(x, y) => updateQ(i, { correct_answer: addMapPoint(q.correct_answer, x, y) })}
                        onMove={(pi, x, y) => updateQ(i, { correct_answer: setMapPoint(q.correct_answer, pi, { x, y }) })}
                        onRemove={(pi) => updateQ(i, { correct_answer: removeMapPoint(q.correct_answer, pi) })}
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">ارفع صورة خريطة ثم اضغط على المواقع المطلوبة لإضافتها.</div>
                    )}
                    {getMapPoints(q.correct_answer).map((p, pi) => (
                      <div key={pi} className="rounded-lg border p-2 space-y-2 bg-background">
                        <div className="grid gap-2 md:grid-cols-[32px_1fr_90px_90px_auto] items-center">
                          <Badge variant="outline" className="justify-center">{pi + 1}</Badge>
                          <Input placeholder="الإجابة الصحيحة (اسم الموقع)" value={p.label} onChange={(e) => updateQ(i, { correct_answer: setMapPoint(q.correct_answer, pi, { label: e.target.value }) })} />
                          <Input type="number" min={0} max={100} step="0.1" value={p.x} onChange={(e) => updateQ(i, { correct_answer: setMapPoint(q.correct_answer, pi, { x: Number(e.target.value) }) })} />
                          <Input type="number" min={0} max={100} step="0.1" value={p.y} onChange={(e) => updateQ(i, { correct_answer: setMapPoint(q.correct_answer, pi, { y: Number(e.target.value) }) })} />
                          <Button variant="ghost" size="icon" onClick={() => updateQ(i, { correct_answer: removeMapPoint(q.correct_answer, pi) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                        <Input placeholder={`سؤال الرقم ${pi + 1} (مثال: ما اسم هذا المحيط؟) — اختياري`} value={p.prompt ?? ""} onChange={(e) => updateQ(i, { correct_answer: setMapPoint(q.correct_answer, pi, { prompt: e.target.value }) })} />
                        <MapPointQuestions
                          value={p.questions ?? []}
                          onChange={(qs) => updateQ(i, { correct_answer: setMapPoint(q.correct_answer, pi, { questions: qs }) })}
                        />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">اضغط على الخريطة لإضافة رقم جديد. لكل رقم يمكنك كتابة الإجابة المختصرة (الحقل العلوي) و/أو إضافة أسئلة فرعية متعددة الأنواع (MCQ، صح/خطأ، إكمال، مقالي).</p>

                  </div>
                )}

                <Textarea placeholder="شرح الإجابة (اختياري)" value={q.explanation ?? ""} onChange={(e) => updateQ(i, { explanation: e.target.value })} rows={1} />
              </CardContent>
            </Card>
          ))}

          {questions.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={() => saveQs.mutate()} disabled={saveQs.isPending}><Save className="h-4 w-4 ml-1" />حفظ الأسئلة</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>البيانات الأساسية</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="عنوان الامتحان *"><Input value={meta.title ?? ""} onChange={(e) => setM("title", e.target.value)} /></Field>
              <Field label="المادة">
                <Select value={meta.subject ?? ""} onValueChange={(v) => setM("subject", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="تاريخ">تاريخ</SelectItem>
                    <SelectItem value="جغرافيا">جغرافيا</SelectItem>
                    <SelectItem value="مواطنة">مواطنة</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="الوصف" className="md:col-span-2">
                <Textarea value={meta.description ?? ""} onChange={(e) => setM("description", e.target.value)} rows={2} />
              </Field>
              <Field label="الصف الدراسي">
                <Select value={meta.class_id ?? ""} onValueChange={(v) => setM("class_id", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="زمن الامتحان (دقيقة) *"><Input type="number" value={meta.duration_minutes ?? 30} onChange={(e) => setM("duration_minutes", Number(e.target.value))} /></Field>
              <Field label="عدد المحاولات المسموحة"><Input type="number" min={1} value={meta.attempts_allowed ?? 1} onChange={(e) => setM("attempts_allowed", Number(e.target.value))} /></Field>
              <Field label="إظهار النتيجة">
                <Select value={meta.show_result_mode ?? "immediate"} onValueChange={(v) => setM("show_result_mode", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">فورًا</SelectItem>
                    <SelectItem value="after_review">بعد المراجعة</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="بداية الامتحان"><Input type="datetime-local" value={isoToLocalInput(meta.starts_at)} onChange={(e) => setM("starts_at", localInputToIso(e.target.value))} /></Field>
              <Field label="نهاية الامتحان"><Input type="datetime-local" value={isoToLocalInput(meta.ends_at)} onChange={(e) => setM("ends_at", localInputToIso(e.target.value))} /></Field>
              <Field label="عدد النماذج"><Input type="number" min={1} value={meta.num_variants ?? 1} onChange={(e) => setM("num_variants", Number(e.target.value))} /></Field>
              <div className="flex items-center justify-between md:col-span-2 border rounded-lg p-3">
                <Label>خلط ترتيب الأسئلة</Label>
                <Switch checked={!!meta.shuffle_questions} onCheckedChange={(v) => setM("shuffle_questions", v)} />
              </div>
              <div className="flex items-center justify-between md:col-span-2 border rounded-lg p-3">
                <Label>خلط ترتيب الاختيارات</Label>
                <Switch checked={!!meta.shuffle_options} onCheckedChange={(v) => setM("shuffle_options", v)} />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending}><Save className="h-4 w-4 ml-1" />حفظ الإعدادات</Button>
          </div>
        </TabsContent>

        <TabsContent value="anticheat" className="mt-4">
          <Card>
            <CardHeader><CardTitle>مكافحة الغش</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { k: "block_copy", label: "منع نسخ النص" },
                { k: "block_paste", label: "منع لصق الإجابات" },
                { k: "single_device", label: "منع فتح الامتحان من أكثر من جهاز" },
                { k: "track_leaves", label: "تسجيل مرات مغادرة صفحة الامتحان" },
                { k: "track_time", label: "تسجيل وقت كل سؤال" },
                { k: "track_ip", label: "تسجيل عنوان IP والجهاز المستخدم" },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between border rounded-lg p-3">
                  <Label>{r.label}</Label>
                  <Switch checked={!!meta.anti_cheat?.[r.k]} onCheckedChange={(v) => setAC(r.k, v)} />
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex justify-end mt-3">
            <Button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending}><Save className="h-4 w-4 ml-1" />حفظ الإعدادات</Button>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={aiMapDlg.open} onOpenChange={(v) => setAiMapDlg((p) => ({ ...p, open: v }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>توليد سؤال خريطة بالذكاء الاصطناعي</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>الموضوع/الدرس</Label>
              <Input value={aiMapDlg.topic} onChange={(e) => setAiMapDlg((p) => ({ ...p, topic: e.target.value }))} placeholder="مثال: تضاريس أستراليا، عواصم أوروبا..." />
            </div>
            <div className="space-y-1.5"><Label>عدد النقاط</Label>
              <Input type="number" min={1} max={20} value={aiMapDlg.num} onChange={(e) => setAiMapDlg((p) => ({ ...p, num: Number(e.target.value) }))} />
            </div>
            <p className="text-xs text-muted-foreground">
              سيقوم الذكاء الاصطناعي بتوليد صورة خريطة (إن لم تكن مرفوعة) وتحديد النقاط والأسئلة والإجابات تلقائيًا.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiMapDlg((p) => ({ ...p, open: false }))}>إلغاء</Button>
            <Button disabled={aiMapDlg.busy || !aiMapDlg.topic.trim()} onClick={async () => {
              setAiMapDlg((p) => ({ ...p, busy: true }));
              try {
                const currentQ = questions[aiMapDlg.qi];
                const r: any = await aiMapFn({ data: {
                  topic: aiMapDlg.topic.trim(),
                  num_points: aiMapDlg.num,
                  map_image_data_url: currentQ?.image_url ?? null,
                } });
                updateQ(aiMapDlg.qi, {
                  text: currentQ?.text?.trim() ? currentQ.text : r.title,
                  image_url: r.image_url ?? currentQ?.image_url ?? null,
                  correct_answer: { points: r.points },
                });
                toast.success(`تم توليد ${r.points.length} نقطة`);
                setAiMapDlg({ open: false, qi: -1, topic: "", num: 6, busy: false });
              } catch (e: any) { toast.error(e?.message ?? "فشل التوليد"); setAiMapDlg((p) => ({ ...p, busy: false })); }
            }}>
              {aiMapDlg.busy ? "جارٍ التوليد..." : <><Sparkles className="h-4 w-4 ml-1" />توليد</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={libDlg.open} onOpenChange={(v) => setLibDlg({ open: v, qi: libDlg.qi })}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>مكتبة الخرائط</DialogTitle></DialogHeader>
          {libItems === null ? (
            <Skeleton className="h-32" />
          ) : libItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد قوالب بعد. أنشئ قوالب من صفحة "مكتبة الخرائط".</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {libItems.map((t: any) => (
                <Card key={t.id} className="cursor-pointer hover:border-primary transition" onClick={() => {
                  const pts = Array.isArray(t.data?.points) ? t.data.points : [];
                  updateQ(libDlg.qi, { image_url: t.image_url, correct_answer: { points: pts } });
                  toast.success(`تم إدراج "${t.title}"`);
                  setLibDlg({ open: false, qi: -1 });
                }}>
                  <div className="bg-muted h-32"><img src={t.image_url} alt={t.title} className="w-full h-full object-contain" /></div>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t.title}</CardTitle></CardHeader>
                  <CardContent className="pt-0 flex justify-between text-xs text-muted-foreground">
                    <span>{t.category ?? ""}</span>
                    <span>{(t.data?.points?.length ?? 0)} نقطة</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}

function MapTargetEditor({
  imageUrl,
  points,
  onPick,
  onMove,
  onRemove,
}: {
  imageUrl: string;
  points: MapPoint[];
  onPick: (x: number, y: number) => void;
  onMove?: (index: number, x: number, y: number) => void;
  onRemove?: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const draggedRef = useRef(false);

  const coordsFromEvent = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = Math.round(((clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((clientY - rect.top) / rect.height) * 1000) / 10;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  useEffect(() => {
    if (dragging === null) return;
    const move = (e: PointerEvent) => {
      const c = coordsFromEvent(e.clientX, e.clientY);
      if (c && onMove) { draggedRef.current = true; onMove(dragging, c.x, c.y); }
    };
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragging, onMove]);

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        💡 اضغط على أي مكان في الخريطة لإضافة نقطة جديدة — اسحب النقاط لنقل موضعها — استخدم زر ✕ أعلى كل نقطة لحذفها.
      </div>
      <div
        className="w-full overflow-auto rounded-lg border-2 border-dashed border-primary/30 bg-muted p-2 text-center"
      >
      <div
        ref={containerRef}
        className="relative inline-block max-w-full select-none align-top text-right"
        onClick={(event) => {
          if (draggedRef.current) { draggedRef.current = false; return; }
          const c = coordsFromEvent(event.clientX, event.clientY);
          if (c) onPick(c.x, c.y);
        }}
        style={{ cursor: "crosshair" }}
      >
        <img src={imageUrl} alt="خريطة السؤال" className="pointer-events-none block max-h-96 max-w-full" draggable={false} />
        {points.map((p, index) => (
          <div
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              role="button"
              tabIndex={0}
              title={`${p.label} — اسحب للنقل`}
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); setDragging(index); }}
              className="flex h-8 w-8 cursor-grab items-center justify-center rounded-full border-2 border-white bg-destructive text-sm font-bold text-destructive-foreground shadow-lg active:cursor-grabbing"
            >
              {index + 1}
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-slate-900 text-[10px] font-bold text-white shadow hover:bg-red-600"
                title="حذف هذه النقطة"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
