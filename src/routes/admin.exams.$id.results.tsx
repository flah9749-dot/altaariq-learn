import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight, Award, TrendingUp, Users, CheckCircle2, XCircle, FileEdit,
  ShieldCheck, RotateCcw, Sparkles, Download, FileSpreadsheet, MessageCircle, Save, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { pickResultTemplate } from "@/lib/whatsapp-templates";
import {
  gradeEssay, approveAttempt, updateAttemptScore, regradeAttempt, reopenAttempt, aiSuggestEssayGrade, sendWhatsAppLog,
} from "@/lib/exams.functions";
import { computeGrade, formatDuration } from "@/lib/exam-utils";
import { exportToExcel, exportToPdf } from "@/lib/reports-lazy";
import { MapAnswerReview } from "@/components/exams/MapAnswerReview";

export const Route = createFileRoute("/admin/exams/$id/results")({
  validateSearch: (s: Record<string, unknown>) => ({
    attempt: typeof s.attempt === "string" ? s.attempt : undefined,
  }),
  head: () => ({ meta: [
    { title: "تقارير الامتحان — الطارق التعليمية" },
    { name: "description", content: "مراجعة وتصحيح واعتماد نتائج امتحانات منصة الطارق التعليمية." },
    { property: "og:title", content: "تقارير الامتحان — الطارق التعليمية" },
    { property: "og:description", content: "مراجعة وتصحيح واعتماد نتائج امتحانات منصة الطارق التعليمية." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ExamResultsPage,
});

function ExamResultsPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [approving, setApproving] = useState<any | null>(null);
  const [reopenTarget, setReopenTarget] = useState<any | null>(null);
  const [editScore, setEditScore] = useState<{ id: string; value: string; notes: string } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [essayPts, setEssayPts] = useState<Record<string, string>>({});

  const gradeFn = useServerFn(gradeEssay);
  const approveFn = useServerFn(approveAttempt);
  const updateFn = useServerFn(updateAttemptScore);
  const regradeFn = useServerFn(regradeAttempt);
  const reopenFn = useServerFn(reopenAttempt);
  const aiFn = useServerFn(aiSuggestEssayGrade);
  const waLogFn = useServerFn(sendWhatsAppLog);

  const { data: exam } = useQuery({
    queryKey: ["exam", id],
    queryFn: async () => (await supabase.from("exams").select("*, classes(name)").eq("id", id).maybeSingle()).data,
  });
  const { data: attempts, isLoading } = useQuery({
    queryKey: ["exam-attempts", id],
    queryFn: async () => (await supabase.from("exam_attempts")
      .select("*, students(id,full_name,code,parent_whatsapp,parent_phone)")
      .eq("exam_id", id).order("percentage", { ascending: false })).data ?? [],
  });
  const { data: questions } = useQuery({
    queryKey: ["exam-questions-r", id],
    queryFn: async () => (await supabase.from("questions").select("id,text,type,points").eq("exam_id", id).order("order_index")).data ?? [],
  });
  const { data: allAnswers } = useQuery({
    queryKey: ["exam-answers", id],
    enabled: !!attempts?.length,
    queryFn: async () => {
      const ids = (attempts ?? []).map((a: any) => a.id);
      if (!ids.length) return [];
      return (await supabase.from("attempt_answers").select("*").in("attempt_id", ids)).data ?? [];
    },
  });

  const stats = useMemo(() => {
    const done = (attempts ?? []).filter((a: any) => a.status !== "in_progress");
    const scores = done.map((a: any) => Number(a.percentage) || 0);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const max = scores.length ? Math.max(...scores) : 0;
    const pass = scores.length ? Math.round((scores.filter((s) => s >= 50).length / scores.length) * 100) : 0;
    const approvedCount = done.filter((a: any) => a.approved).length;
    const buckets = [
      { name: "0-49%", value: scores.filter((s) => s < 50).length },
      { name: "50-64%", value: scores.filter((s) => s >= 50 && s < 65).length },
      { name: "65-84%", value: scores.filter((s) => s >= 65 && s < 85).length },
      { name: "85-100%", value: scores.filter((s) => s >= 85).length },
    ];
    return { count: done.length, avg, max, pass, buckets, approvedCount };
  }, [attempts]);

  const qStats = useMemo(() => {
    if (!questions || !allAnswers) return [] as any[];
    return questions.map((q: any) => {
      const ans = allAnswers.filter((a: any) => a.question_id === q.id);
      const correct = ans.filter((a: any) => a.is_correct === true).length;
      const wrong = ans.filter((a: any) => a.is_correct === false).length;
      return { id: q.id, text: q.text.slice(0, 40), type: q.type, correct, wrong, total: ans.length };
    });
  }, [questions, allAnswers]);

  const mostWrong = useMemo(() => [...qStats].sort((a, b) => b.wrong - a.wrong)[0], [qStats]);
  const mostRight = useMemo(() => [...qStats].sort((a, b) => b.correct - a.correct)[0], [qStats]);

  const COLORS = ["hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--success))"];

  const openReview = async (att: any) => {
    const { data } = await supabase.rpc("get_attempt_review", { _attempt_id: att.id });
    setReviewing({ attempt: att, answers: (data as any) ?? [] });
  };

  const search = Route.useSearch();
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    const target = search.attempt;
    if (!target || autoOpenedRef.current === target) return;
    const att = (attempts ?? []).find((a: any) => a.id === target);
    if (att) {
      autoOpenedRef.current = target;
      openReview(att);
    }
  }, [search.attempt, attempts]);


  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["exam-attempts", id] });
    qc.invalidateQueries({ queryKey: ["exam-answers", id] });
  };

  const submitEssay = useMutation({
    mutationFn: async ({ attemptId, questionId, points }: { attemptId: string; questionId: string; points: number }) =>
      gradeFn({ data: { attempt_id: attemptId, question_id: questionId, awarded_points: points } }),
    onSuccess: () => { toast.success("تم تسجيل الدرجة"); invalidateAll(); openReviewRefresh(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التسجيل"),
  });

  const aiSuggest = useMutation({
    mutationFn: async ({ attemptId, questionId }: { attemptId: string; questionId: string }) =>
      aiFn({ data: { attempt_id: attemptId, question_id: questionId } }),
    onSuccess: (r: any, vars) => {
      toast.success(`اقتراح AI: ${r.score}`);
      setEssayPts((p) => ({ ...p, [vars.questionId]: String(r.score) }));
      openReviewRefresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الاقتراح"),
  });

  const openReviewRefresh = async () => {
    if (!reviewing?.attempt) return;
    const { data } = await supabase.rpc("get_attempt_review", { _attempt_id: reviewing.attempt.id });
    setReviewing((prev: any) => prev ? { ...prev, answers: (data as any) ?? [] } : prev);
  };

  const approve = useMutation({
    mutationFn: async ({ attemptId, notes }: { attemptId: string; notes: string }) =>
      approveFn({ data: { attempt_id: attemptId, admin_notes: notes || null } }),
    onSuccess: (r: any) => { toast.success(`تم الاعتماد (+${r.points_awarded} نقطة)`); invalidateAll(); setApproving(null); setAdminNotes(""); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الاعتماد"),
  });

  const reopen = useMutation({
    mutationFn: async (attemptId: string) => reopenFn({ data: { attempt_id: attemptId } }),
    onSuccess: () => { toast.success("تم إعادة فتح المحاولة"); invalidateAll(); setReopenTarget(null); },
    onError: (e: any) => toast.error(e?.message ?? "فشل إعادة الفتح"),
  });

  const saveScore = useMutation({
    mutationFn: async () => updateFn({ data: { attempt_id: editScore!.id, score: Number(editScore!.value), admin_notes: editScore!.notes || null } }),
    onSuccess: () => { toast.success("تم تحديث الدرجة"); invalidateAll(); setEditScore(null); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التعديل"),
  });

  const regrade = useMutation({
    mutationFn: async (attemptId: string) => regradeFn({ data: { attempt_id: attemptId } }),
    onSuccess: (r: any) => { toast.success(`تمت إعادة التصحيح — ${r.score}/${r.total}`); invalidateAll(); openReviewRefresh(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل إعادة التصحيح"),
  });

  const rows = (attempts ?? []).map((a: any, i: number) => ({
    "الترتيب": i + 1, "الاسم": a.students?.full_name ?? "—", "الكود": a.students?.code ?? "—",
    "الدرجة": `${a.score ?? 0} / ${a.total ?? 0}`, "النسبة": `${a.percentage ?? 0}%`,
    "التقدير": a.grade ?? computeGrade(Number(a.percentage) || 0),
    "الوقت": formatDuration(a.time_spent_sec ?? 0),
    "معتمدة": a.approved ? "نعم" : "لا",
    "الحالة": a.status,
  }));

  const doExcel = () => exportToExcel(rows, `نتائج-${exam?.title ?? "امتحان"}.xlsx`);
  const doPdf = () => exportToPdf({
    title: `نتائج امتحان: ${exam?.title ?? ""}`,
    subtitle: `${exam?.classes?.name ?? ""} — ${stats.count} مشارك — متوسط ${stats.avg}%`,
    columns: ["#", "الاسم", "الكود", "الدرجة", "النسبة", "التقدير", "الوقت", "معتمدة"],
    rows: rows.map((r) => [r["الترتيب"], r["الاسم"], r["الكود"], r["الدرجة"], r["النسبة"], r["التقدير"], r["الوقت"], r["معتمدة"]]),
    filename: `نتائج-${exam?.title ?? "امتحان"}.pdf`,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/admin/exams" })}>
          <ArrowRight className="h-4 w-4 ml-1" />القائمة
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{exam?.title ?? "..."}</h1>
          <p className="text-sm text-muted-foreground">{exam?.classes?.name ?? ""} — {stats.count} مشارك — {stats.approvedCount} معتمدة</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/exams/$id/analytics" params={{ id }}><BarChart3 className="h-4 w-4 ml-1"/>تحليل ذكي</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={doExcel}><FileSpreadsheet className="h-4 w-4 ml-1"/>Excel</Button>
        <Button variant="outline" size="sm" onClick={doPdf}><Download className="h-4 w-4 ml-1"/>PDF</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard icon={Users} label="المشاركون" value={stats.count} />
        <StatCard icon={TrendingUp} label="المتوسط" value={`${stats.avg}%`} />
        <StatCard icon={Award} label="أعلى درجة" value={`${stats.max}%`} color="text-gold" />
        <StatCard icon={ShieldCheck} label="نسبة النجاح" value={`${stats.pass}%`} color="text-success" />
      </div>

      {stats.count > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">توزيع الدرجات</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.buckets} dataKey="value" nameKey="name" outerRadius={80} label>
                    {stats.buckets.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Legend /><Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">أداء الأسئلة</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="text" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend />
                  <Bar dataKey="correct" fill="hsl(var(--success))" name="صحيح" />
                  <Bar dataKey="wrong" fill="hsl(var(--destructive))" name="خطأ" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {(mostWrong || mostRight) && (
        <div className="grid gap-4 md:grid-cols-2">
          {mostWrong && <Card className="border-destructive/30">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" />أكثر سؤال خاطئ</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{mostWrong.text}...</p><p className="text-xs text-muted-foreground mt-2">{mostWrong.wrong} خطأ من {mostWrong.total}</p></CardContent>
          </Card>}
          {mostRight && <Card className="border-success/30">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />أكثر سؤال صحيح</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{mostRight.text}...</p><p className="text-xs text-muted-foreground mt-2">{mostRight.correct} صحيح من {mostRight.total}</p></CardContent>
          </Card>}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>نتائج الطلاب</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead><TableHead>الطالب</TableHead><TableHead>الكود</TableHead>
                <TableHead>الدرجة</TableHead><TableHead>النسبة</TableHead><TableHead>التقدير</TableHead>
                <TableHead>الوقت</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({length:3}).map((_,i)=> <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8"/></TableCell></TableRow>) :
              (attempts ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا يوجد محاولات بعد</TableCell></TableRow>
              ) : (attempts ?? []).map((a: any, i: number) => {
                const waVars = {
                  name: a.students?.full_name ?? "",
                  exam: exam?.title ?? "",
                  score: a.score ?? 0,
                  total: a.total ?? 0,
                  percentage: a.percentage ?? 0,
                  grade_text: a.grade ?? computeGrade(Number(a.percentage)),
                };
                return (
                  <TableRow key={a.id}>
                    <TableCell><Badge variant={i === 0 ? "default" : "outline"}>{i + 1}</Badge></TableCell>
                    <TableCell>
                      <Link to="/admin/students/$id" params={{ id: a.students?.id }} className="hover:underline">{a.students?.full_name ?? "—"}</Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.students?.code ?? "—"}</TableCell>
                    <TableCell>{a.score} / {a.total}</TableCell>
                    <TableCell>{a.percentage}%</TableCell>
                    <TableCell><Badge variant="secondary">{a.grade ?? "—"}</Badge></TableCell>
                    <TableCell className="text-xs">{formatDuration(a.time_spent_sec ?? 0)}</TableCell>
                    <TableCell>
                      {a.approved ? <Badge className="bg-gold text-gold-foreground"><ShieldCheck className="h-3 w-3 ml-1 inline"/>معتمدة</Badge>
                       : a.status === "graded" ? <Badge className="bg-success text-success-foreground">مصححة</Badge>
                       : a.status === "submitted" ? <Badge className="bg-warning text-warning-foreground">تحتاج مراجعة</Badge>
                       : <Badge variant="outline">قيد الأداء</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap items-center">
                        <Button size="sm" variant="default" onClick={() => openReview(a)} className="gap-1">
                          <FileEdit className="h-3.5 w-3.5" />
                          <span>مراجعة وتعديل</span>
                        </Button>
                        {!a.approved && a.status !== "in_progress" && (
                          <Button size="sm" variant="secondary" onClick={() => regrade.mutate(a.id)} disabled={regrade.isPending} className="gap-1" title="إعادة التصحيح التلقائي بالمنطق الحالي">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>إعادة تصحيح</span>
                          </Button>
                        )}
                        {!a.approved && a.status !== "in_progress" && (
                          <Button size="sm" variant="outline" onClick={() => setEditScore({ id: a.id, value: String(a.score ?? 0), notes: a.admin_notes ?? "" })} className="gap-1" title="تعديل الدرجة الإجمالية يدويًا">
                            <Save className="h-3.5 w-3.5" />
                            <span>تعديل الدرجة</span>
                          </Button>
                        )}
                        {!a.approved && a.status !== "in_progress" && (
                          <Button size="sm" variant="outline" onClick={() => { setApproving(a); setAdminNotes(a.admin_notes ?? ""); }} className="gap-1 border-gold text-gold hover:bg-gold/10" title="اعتماد النتيجة نهائيًا ومنح النقاط">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>اعتماد</span>
                          </Button>
                        )}
                        {a.approved && (
                          <Button size="sm" variant="ghost" onClick={() => setReopenTarget(a)} className="gap-1 text-destructive" title="إعادة فتح للتعديل">
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>إعادة فتح</span>
                          </Button>
                        )}
                        <WhatsAppButton phone={a.students?.parent_whatsapp ?? a.students?.parent_phone} template={pickResultTemplate(Number(a.percentage) || 0)} vars={waVars} size="icon" variant="ghost"
                          onClick={() => waLogFn({ data: { student_id: a.students?.id, exam_id: id } }).catch(() => {})} />
                      </div>
                    </TableCell>

                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent dir="rtl" className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>مراجعة إجابات: {reviewing?.attempt?.students?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(reviewing?.answers ?? []).map((a: any) => {
              const questionPoints = getQuestionDisplayPoints(a.questions);
              return (
              <div key={a.id} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline">{a.questions?.type}</Badge>
                  <span className="text-xs text-muted-foreground">{questionPoints} درجة</span>
                  {a.is_correct === true && <Badge className="bg-success text-success-foreground">صحيح</Badge>}
                  {a.is_correct === false && <Badge variant="destructive">خطأ</Badge>}
                  {a.awarded_points != null && <span className="mr-auto text-sm font-medium">{a.awarded_points}/{questionPoints}</span>}
                </div>
                <p className="font-medium text-sm mb-1">{a.questions?.text}</p>
                {a.questions?.type === "map" ? (
                  <MapAnswerReview question={a.questions} answer={a.answer} />
                ) : (
                  <>
                    {a.questions?.image_url && <img src={a.questions.image_url} alt="صورة السؤال" className="mb-2 max-h-64 rounded-lg border" />}
                    <div className="text-sm bg-muted/50 p-2 rounded">
                      <span className="text-xs text-muted-foreground">إجابة الطالب: </span>
                      <span>{formatAnswer(a.answer, a.questions)}</span>
                    </div>
                  </>
                )}
                {a.ai_feedback && (
                  <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/20 text-xs">
                    <Sparkles className="h-3 w-3 inline ml-1 text-primary" />
                    <span className="font-semibold">تعليق AI:</span> {a.ai_feedback}
                    {a.ai_suggested_points != null && <span className="mr-2">— اقتراح: {a.ai_suggested_points}</span>}
                  </div>
                )}
                <div className="flex gap-2 mt-2 flex-wrap items-center">
                  <span className="text-xs text-muted-foreground">تعديل الدرجة:</span>
                  <Input type="number" step="0.5" min={0} max={questionPoints || undefined} placeholder="الدرجة"
                    value={essayPts[a.question_id] ?? (a.awarded_points ?? "")}
                    onChange={(e) => setEssayPts((p) => ({ ...p, [a.question_id]: e.target.value }))}
                    className="w-24 h-8" />
                  <span className="text-xs text-muted-foreground">/ {questionPoints}</span>
                  <Button size="sm" onClick={() => submitEssay.mutate({ attemptId: reviewing.attempt.id, questionId: a.question_id, points: Number(essayPts[a.question_id] ?? a.awarded_points ?? 0) })} disabled={submitEssay.isPending}>
                    حفظ
                  </Button>
                  {a.questions?.type === "essay" && (
                    <Button size="sm" variant="outline" onClick={() => aiSuggest.mutate({ attemptId: reviewing.attempt.id, questionId: a.question_id })} disabled={aiSuggest.isPending}>
                      <Sparkles className="h-3 w-3 ml-1" />اقتراح AI
                    </Button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReviewing(null)}>إغلاق</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>اعتماد نتيجة: {approving?.students?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>سيتم منح النقاط للطالب وتحديث مستواه.</p>
            <div className="p-3 bg-muted/50 rounded">الدرجة: {approving?.score}/{approving?.total} ({approving?.percentage}%)</div>
            <Textarea placeholder="ملاحظات للطالب (اختياري)" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproving(null)}>إلغاء</Button>
            <Button onClick={() => approve.mutate({ attemptId: approving.id, notes: adminNotes })} disabled={approve.isPending}>
              <ShieldCheck className="h-4 w-4 ml-1" />اعتماد ومنح النقاط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit score dialog */}
      <Dialog open={!!editScore} onOpenChange={(o) => !o && setEditScore(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تعديل الدرجة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="number" step="0.5" value={editScore?.value ?? ""} onChange={(e) => setEditScore((p) => p ? { ...p, value: e.target.value } : p)} />
            <Textarea placeholder="سبب التعديل" value={editScore?.notes ?? ""} onChange={(e) => setEditScore((p) => p ? { ...p, notes: e.target.value } : p)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditScore(null)}>إلغاء</Button>
            <Button onClick={() => saveScore.mutate()} disabled={saveScore.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen alert */}
      <AlertDialog open={!!reopenTarget} onOpenChange={(o) => !o && setReopenTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إعادة فتح المحاولة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إلغاء الاعتماد وسحب النقاط الممنوحة ({reopenTarget?.points_awarded ?? 0}) والسماح للطالب بإعادة الحل.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => reopen.mutate(reopenTarget.id)}>تأكيد الفتح</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-8 w-8 ${color ?? "text-primary"}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </CardContent></Card>
  );
}

function getQuestionDisplayPoints(question: any) {
  if (question?.type === "map") {
    const points = Array.isArray(question?.correct_answer?.points) ? question.correct_answer.points : [];
    const total = points.reduce((sum: number, point: any) => {
      const subs = Array.isArray(point?.questions) ? point.questions : [];
      const subTotal = subs.reduce((s: number, sq: any) => s + Math.max(0, Number(sq.points) || 0), 0);
      return sum + (subTotal > 0 ? subTotal : 1);
    }, 0);
    if (total > 0) return total;
  }
  return Number(question?.points) || 0;
}

function lookupOptionText(value: any, options: any[]): string | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  // by id (uuid)
  const byId = options.find((o) => o?.id === value);
  if (byId) return String(byId.text ?? "");
  // by numeric index
  const asNum = Number(value);
  if (Number.isFinite(asNum) && options[asNum]) return String(options[asNum].text ?? "");
  return null;
}

function formatMapSubAnswer(value: any, sq: any) {
  if (value == null || value === "") return "—";
  if (sq?.type === "mcq") {
    const opts = sq.options ?? sq.question_options ?? [];
    if (Array.isArray(value)) {
      return value.map((v) => lookupOptionText(v, opts) ?? String(v)).join("، ");
    }
    return lookupOptionText(value, opts) ?? String(value);
  }
  if (sq?.type === "true_false") return String(value) === "true" ? "صح" : "خطأ";
  return String(value);
}

function formatAnswer(answer: any, question?: any) {
  if (answer == null || answer === "") return "لا إجابة";
  const type = typeof question === "string" ? question : question?.type;
  if (type === "mcq") {
    const opts = question?.question_options ?? question?.options ?? [];
    if (Array.isArray(answer)) {
      return answer.map((v) => lookupOptionText(v, opts) ?? String(v)).join("، ");
    }
    return lookupOptionText(answer, opts) ?? String(answer);
  }
  if (type === "true_false") return String(answer) === "true" ? "صح" : "خطأ";
  if (type === "map") {
    const points = Array.isArray(question?.correct_answer?.points) ? question.correct_answer.points : [];
    const items = answer?.items && typeof answer.items === "object" ? answer.items : null;
    if (items && points.length) {
      return points.map((point: any, pi: number) => {
        const subs = Array.isArray(point?.questions) ? point.questions : [];
        if (!subs.length) return `${pi + 1}. ${String(answer?.labels?.[pi] ?? "").trim() || "—"}`;
        const parts = subs.map((sq: any, si: number) => `س${si + 1}: ${formatMapSubAnswer(items[String(pi)]?.[sq.id], sq)}`);
        return `${pi + 1}. ${parts.join("، ")}`;
      }).join(" | ");
    }
    const labels = Array.isArray(answer?.labels) ? answer.labels : Array.isArray(answer) ? answer : null;
    if (labels) {
      const list = labels.map((l: any, i: number) => `${i + 1}. ${String(l ?? "").trim() || "—"}`).join(" | ");
      return list || "لا إجابة";
    }
    const point = Array.isArray(answer?.points) ? answer.points[0] : answer;
    if (point && typeof point === "object" && "label" in point) return String(point.label ?? "");
  }
  return typeof answer === "object" ? JSON.stringify(answer) : String(answer);
}
