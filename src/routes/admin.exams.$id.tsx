import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight, Save, Plus, Trash2, GripVertical, CheckCircle2, XCircle,
  Sparkles, Settings2, FileText,
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
import { QUESTION_TYPES, type QuestionType } from "@/lib/exam-utils";

export const Route = createFileRoute("/admin/exams/$id")({
  head: () => ({ meta: [{ title: "تعديل الامتحان" }] }),
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
  return base;
}

function ExamEditor() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertExam);
  const saveQFn = useServerFn(saveQuestions);
  const pubFn = useServerFn(publishExam);

  const [meta, setMeta] = useState<any | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);

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
    if (dbQuestions) {
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
                  <Select value={q.type} onValueChange={(v) => updateQ(i, { ...makeBlank(v as QuestionType), text: q.text, points: q.points })}>
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
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}
