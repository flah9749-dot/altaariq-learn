import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, ChevronRight, ChevronLeft, CheckCircle2, Loader2, AlertCircle, Bookmark, BookmarkCheck, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { startAttempt, saveAnswer, submitAttempt, recordLeave, saveReviewMarks } from "@/lib/exams.functions";
import { formatDuration } from "@/lib/exam-utils";

export const Route = createFileRoute("/student/exams/$id/take")({
  head: () => ({ meta: [{ title: "أداء الامتحان" }] }),
  component: TakeExamPage,
});

function TakeExamPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const startFn = useServerFn(startAttempt);
  const saveFn = useServerFn(saveAnswer);
  const submitFn = useServerFn(submitAttempt);
  const leaveFn = useServerFn(recordLeave);
  const marksFn = useServerFn(saveReviewMarks);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [reviewMarks, setReviewMarks] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const startedAt = useRef(Date.now());
  const questionStartAt = useRef(Date.now());

  const { data: exam } = useQuery({
    queryKey: ["take-exam", id],
    queryFn: async () => (await supabase.from("exams").select("*").eq("id", id).eq("published", true).maybeSingle()).data,
  });
  const { data: questions } = useQuery({
    queryKey: ["take-questions", id], enabled: !!exam,
    queryFn: async () => (await supabase.from("questions")
      .select("*, question_options(id,text,image_url,order_index,match_key)")
      .eq("exam_id", id).order("order_index")).data ?? [],
  });

  // Start attempt on load
  useEffect(() => {
    if (!exam) return;
    startFn({ data: { exam_id: id } }).then((r: any) => {
      setAttemptId(r.attempt_id);
      // Load real started_at from DB so refresh doesn't reset the timer
      supabase.from("exam_attempts").select("started_at,review_marks").eq("id", r.attempt_id).maybeSingle().then(({ data }) => {
        if (data?.started_at) {
          startedAt.current = new Date(data.started_at).getTime();
          setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
        }
        if (Array.isArray(data?.review_marks)) setReviewMarks(new Set(data!.review_marks as string[]));
      });
      // Load prior answers
      supabase.from("attempt_answers").select("question_id,answer").eq("attempt_id", r.attempt_id).then(({ data }) => {
        const m: Record<string, any> = {};
        (data ?? []).forEach((a: any) => { m[a.question_id] = a.answer; });
        setAnswers(m);
      });
    }).catch((e: any) => { toast.error(e?.message ?? "فشل بدء الامتحان"); nav({ to: "/student/exams" }); });
  }, [exam, id]);

  // Timer + auto-submit on expiry
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const totalSec = (exam?.duration_minutes ?? 30) * 60;
  const remaining = Math.max(0, totalSec - elapsed);
  useEffect(() => {
    if (attemptId && remaining === 0) doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const ac = (exam?.anti_cheat ?? {}) as { track_leaves?: boolean; block_copy?: boolean; block_paste?: boolean };

  // Anti-cheat: track leaves
  useEffect(() => {
    if (!attemptId || !ac.track_leaves) return;
    const onVis = () => { if (document.hidden) leaveFn({ data: { attempt_id: attemptId } }).catch(() => {}); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [attemptId, ac.track_leaves, leaveFn]);

  // Anti-cheat: copy/paste blocking
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => { if (ac.block_copy) e.preventDefault(); };
    const onPaste = (e: ClipboardEvent) => { if (ac.block_paste) e.preventDefault(); };
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    return () => { document.removeEventListener("copy", onCopy); document.removeEventListener("paste", onPaste); };
  }, [ac.block_copy, ac.block_paste]);

  const shuffled = useMemo(() => {
    if (!questions) return [];
    if (exam?.shuffle_questions) return [...questions].sort(() => Math.random() - 0.5);
    return questions;
  }, [questions, exam?.shuffle_questions]);

  const setAnswer = (qid: string, val: any) => {
    setAnswers((p) => ({ ...p, [qid]: val }));
    if (attemptId) {
      setSaveState("saving");
      const timeSpent = Math.floor((Date.now() - questionStartAt.current) / 1000);
      saveFn({ data: { attempt_id: attemptId, question_id: qid, answer: val, time_spent_sec: timeSpent } })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("idle"));
    }
  };

  const toggleReview = (qid: string) => {
    setReviewMarks((p) => {
      const n = new Set(p);
      if (n.has(qid)) n.delete(qid); else n.add(qid);
      if (attemptId) marksFn({ data: { attempt_id: attemptId, marks: Array.from(n) } }).catch(() => {});
      return n;
    });
  };


  const goto = (i: number) => { questionStartAt.current = Date.now(); setCurrent(i); };

  const doSubmit = useCallback(async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    try {
      const r: any = await submitFn({ data: { attempt_id: attemptId } });
      toast.success(`تم التسليم — ${r.percentage}%`);
      nav({ to: "/student/exams/$id/result", params: { id } });
    } catch (e: any) { toast.error(e?.message ?? "فشل التسليم"); setSubmitting(false); }
  }, [attemptId, submitFn, nav, id, submitting]);

  if (!exam || !questions || !attemptId) return <Skeleton className="h-96" />;

  const q = shuffled[current];
  const answeredCount = Object.keys(answers).filter((k) => answers[k] != null && answers[k] !== "").length;
  const progressPct = (answeredCount / shuffled.length) * 100;
  const lowTime = remaining < 60;

  return (
    <div className="max-w-4xl mx-auto space-y-4" style={{ userSelect: ac.block_copy ? "none" : undefined }}>
      <Card className="sticky top-0 z-10 shadow-md">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div>
            <h2 className="font-bold">{exam.title}</h2>
            <p className="text-xs text-muted-foreground">السؤال {current + 1} من {shuffled.length}</p>
          </div>
          <div className="mr-auto flex items-center gap-2">
            {saveState !== "idle" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 text-success" />}
                {saveState === "saving" ? "جاري الحفظ..." : "تم الحفظ"}
              </span>
            )}
            <div className={`flex items-center gap-1 font-mono text-lg ${lowTime ? "text-destructive animate-pulse" : ""}`}>
              <Clock className="h-4 w-4" />{formatDuration(remaining)}
            </div>
            <Button size="sm" onClick={doSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin ml-1" />}تسليم
            </Button>
          </div>
        </CardContent>
        <div className="px-4 pb-3">
          <Progress value={progressPct} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{answeredCount} / {shuffled.length} إجابة · {reviewMarks.size} للمراجعة</p>
        </div>
      </Card>

      {lowTime && (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" />
          <AlertDescription>تبقى أقل من دقيقة!</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge>{current + 1}</Badge>
            <Badge variant="outline">{q?.points} درجة</Badge>
            <Button size="sm" variant={reviewMarks.has(q?.id) ? "default" : "outline"} className="mr-auto"
              onClick={() => toggleReview(q.id)}>
              {reviewMarks.has(q?.id) ? <><BookmarkCheck className="h-4 w-4 ml-1" />معلَّم للمراجعة</> : <><Bookmark className="h-4 w-4 ml-1" />علِّم للمراجعة</>}
            </Button>
          </div>
          <p className="text-lg font-medium">{q?.text}</p>
          {q?.image_url && <img src={q.image_url} alt="" className="max-h-80 rounded-lg border" />}
          <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} shuffleOptions={exam.shuffle_options} />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => goto(Math.max(0, current - 1))} disabled={current === 0}>
          <ChevronRight className="h-4 w-4 ml-1" />السابق
        </Button>
        {current < shuffled.length - 1 ? (
          <Button onClick={() => goto(current + 1)} className="mr-auto">التالي<ChevronLeft className="h-4 w-4 mr-1" /></Button>
        ) : (
          <Button onClick={doSubmit} disabled={submitting} className="mr-auto"><CheckCircle2 className="h-4 w-4 ml-1" />تسليم الامتحان</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">لوحة الأسئلة</p>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/20 border border-success/40"/>مجابة</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/20 border border-warning/40"/>للمراجعة</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted border"/>لم تُجب</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shuffled.map((sq: any, i: number) => {
              const answered = answers[sq.id] != null && answers[sq.id] !== "";
              const marked = reviewMarks.has(sq.id);
              return (
                <button key={sq.id} onClick={() => goto(i)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium border transition-colors relative ${
                    i === current ? "bg-primary text-primary-foreground border-primary" :
                    marked ? "bg-warning/20 border-warning/40 text-warning-foreground" :
                    answered ? "bg-success/20 border-success/40 text-success" :
                    "bg-muted border-border"
                  }`}>
                  {i + 1}
                  {marked && <Bookmark className="h-2.5 w-2.5 absolute top-0.5 right-0.5" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionInput({ q, value, onChange, shuffleOptions }: { q: any; value: any; onChange: (v: any) => void; shuffleOptions?: boolean }) {
  const opts = useMemo(() => {
    const o = q?.question_options ?? [];
    return shuffleOptions ? [...o].sort(() => Math.random() - 0.5) : [...o].sort((a: any, b: any) => a.order_index - b.order_index);
  }, [q, shuffleOptions]);


  switch (q?.type) {
    case "mcq":
      return (
        <RadioGroup value={typeof value === "string" ? value : ""} onValueChange={(v) => onChange(v)}>
          {opts.map((o: any) => (
            <label key={o.id} className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value={o.id} id={o.id} />
              <span className="flex-1">{o.text}</span>
            </label>
          ))}
        </RadioGroup>
      );
    case "true_false":
      return (
        <RadioGroup value={String(value ?? "")} onValueChange={(v) => onChange(v)}>
          <label className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
            <RadioGroupItem value="true" id="t" /><span>صح</span>
          </label>
          <label className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
            <RadioGroupItem value="false" id="f" /><span>خطأ</span>
          </label>
        </RadioGroup>
      );
    case "complete":
      return <Input placeholder="اكتب إجابتك..." value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "essay":
      return <Textarea placeholder="اكتب إجابتك المقالية..." rows={8} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "order": {
      const arr: string[] = Array.isArray(value) ? value : opts.map((o: any) => o.text);
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">رتّب العناصر (استخدم الأزرار للتحريك)</p>
          {arr.map((item, i) => (
            <div key={i} className="flex items-center gap-2 border rounded-lg p-2">
              <Badge>{i + 1}</Badge>
              <span className="flex-1">{item}</span>
              <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => { const n = [...arr]; [n[i-1], n[i]] = [n[i], n[i-1]]; onChange(n); }}>↑</Button>
              <Button size="icon" variant="ghost" disabled={i === arr.length - 1} onClick={() => { const n = [...arr]; [n[i+1], n[i]] = [n[i], n[i+1]]; onChange(n); }}>↓</Button>
            </div>
          ))}
        </div>
      );
    }
    case "match": {
      const val: Record<string, string> = value && typeof value === "object" ? value : {};
      const keys = opts.map((o: any) => o.match_key).filter(Boolean);
      const values = opts.map((o: any) => o.text);
      const shuffledVals = useMemo(() => [...values].sort(() => Math.random() - 0.5), [q.id]);
      return (
        <div className="space-y-2">
          {keys.map((k: string) => (
            <div key={k} className="flex items-center gap-2">
              <Label className="w-32 font-medium">{k}</Label>
              <select value={val[k] ?? ""} onChange={(e) => onChange({ ...val, [k]: e.target.value })} className="flex-1 border rounded-lg h-10 px-3">
                <option value="">اختر...</option>
                {shuffledVals.map((v, i) => <option key={i} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    default:
      return <p className="text-sm text-muted-foreground">نوع سؤال غير مدعوم</p>;
  }
}
