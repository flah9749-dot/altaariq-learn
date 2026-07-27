import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Search, FileSpreadsheet, Download, ShieldCheck, Filter, FileEdit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { HierarchicalTree } from "@/components/common/HierarchicalTree";

import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { pickResultTemplate } from "@/lib/whatsapp-templates";
import { computeGrade, formatDuration } from "@/lib/exam-utils";
import { formatArabicDate } from "@/lib/students-utils";
import { exportToExcel, exportToPdf } from "@/lib/reports-lazy";

export const Route = createFileRoute("/admin/results")({
  head: () => ({ meta: [
    { title: "نتائج الطلاب — الطارق التعليمية" },
    { name: "description", content: "متابعة نتائج الطلاب ومراجعة الدرجات وإرسال تقارير ولي الأمر في منصة الطارق التعليمية." },
    { property: "og:title", content: "نتائج الطلاب — الطارق التعليمية" },
    { property: "og:description", content: "متابعة نتائج الطلاب ومراجعة الدرجات وإرسال تقارير ولي الأمر في منصة الطارق التعليمية." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResultsPage,
});

type Band = "all" | "excellent" | "good" | "pass" | "fail";

function ResultsPage() {
  const [search, setSearch] = useState("");
  const [examId, setExamId] = useState<string>("all");
  const [classId, setClassId] = useState<string>("all");
  const [band, setBand] = useState<Band>("all");
  const [approved, setApproved] = useState<"all" | "yes" | "no">("all");

  const { data: exams } = useQuery({
    queryKey: ["results-exams-list"],
    queryFn: async () => (await supabase.from("exams").select("id,title,class_id").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: classes } = useQuery({
    queryKey: ["results-classes-list"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["all-results", examId, classId],
    queryFn: async () => {
      let q = supabase.from("exam_attempts")
        .select("id,exam_id,student_id,score,total,percentage,grade,status,approved,time_spent_sec,submitted_at,created_at, students(id,full_name,code,parent_whatsapp,parent_phone,class_id), exams(id,title,class_id)")
        .neq("status", "in_progress")
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (examId !== "all") q = q.eq("exam_id", examId);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];
      if (classId !== "all") rows = rows.filter((r: any) => r.students?.class_id === classId);
      return rows;
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (attempts ?? []).filter((a: any) => {
      const pct = Number(a.percentage) || 0;
      if (band === "excellent" && pct < 85) return false;
      if (band === "good" && (pct < 65 || pct >= 85)) return false;
      if (band === "pass" && (pct < 50 || pct >= 65)) return false;
      if (band === "fail" && pct >= 50) return false;
      if (approved === "yes" && !a.approved) return false;
      if (approved === "no" && a.approved) return false;
      if (term) {
        const hay = `${a.students?.full_name ?? ""} ${a.students?.code ?? ""} ${a.exams?.title ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [attempts, search, band, approved]);

  const stats = useMemo(() => {
    const scores = filtered.map((a: any) => Number(a.percentage) || 0);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const pass = scores.length ? Math.round((scores.filter((s) => s >= 50).length / scores.length) * 100) : 0;
    const excellent = scores.filter((s) => s >= 85).length;
    return { count: filtered.length, avg, pass, excellent };
  }, [filtered]);

  const exportRows = filtered.map((a: any, i: number) => ({
    "#": i + 1,
    "الطالب": a.students?.full_name ?? "—",
    "الكود": a.students?.code ?? "—",
    "الامتحان": a.exams?.title ?? "—",
    "الدرجة": `${a.score ?? 0} / ${a.total ?? 0}`,
    "النسبة": `${a.percentage ?? 0}%`,
    "التقدير": a.grade ?? computeGrade(Number(a.percentage) || 0),
    "الوقت": formatDuration(a.time_spent_sec ?? 0),
    "معتمدة": a.approved ? "نعم" : "لا",
    "التاريخ": formatArabicDate(a.submitted_at ?? a.created_at),
  }));

  const doExcel = () => exportToExcel(exportRows, `النتائج.xlsx`);
  const doPdf = () => exportToPdf({
    title: "تقرير النتائج",
    subtitle: `${stats.count} نتيجة — متوسط ${stats.avg}% — نجاح ${stats.pass}%`,
    columns: ["#", "الطالب", "الكود", "الامتحان", "الدرجة", "النسبة", "التقدير", "الوقت", "معتمدة", "التاريخ"],
    rows: exportRows.map((r) => [r["#"], r["الطالب"], r["الكود"], r["الامتحان"], r["الدرجة"], r["النسبة"], r["التقدير"], r["الوقت"], r["معتمدة"], r["التاريخ"]]),
    filename: `النتائج.pdf`,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" /> النتائج
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.count} نتيجة — متوسط {stats.avg}% — نسبة النجاح {stats.pass}% — متفوقون {stats.excellent}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={doExcel}><FileSpreadsheet className="h-4 w-4 ml-1"/>Excel</Button>
          <Button variant="outline" size="sm" onClick={doPdf}><Download className="h-4 w-4 ml-1"/>PDF</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> الفلاتر</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث باسم الطالب أو كوده أو عنوان الامتحان..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
          </div>
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger><SelectValue placeholder="الامتحان" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الامتحانات</SelectItem>
              {(exams ?? []).map((e: any) => (<SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="الصف" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الصفوف</SelectItem>
              {(classes ?? []).map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={band} onValueChange={(v) => setBand(v as Band)}>
            <SelectTrigger><SelectValue placeholder="التقدير" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التقديرات</SelectItem>
              <SelectItem value="excellent">ممتاز (85%+)</SelectItem>
              <SelectItem value="good">جيد (65-84%)</SelectItem>
              <SelectItem value="pass">مقبول (50-64%)</SelectItem>
              <SelectItem value="fail">ضعيف (أقل من 50%)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={approved} onValueChange={(v) => setApproved(v as any)}>
            <SelectTrigger><SelectValue placeholder="حالة الاعتماد" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="yes">معتمدة</SelectItem>
              <SelectItem value="no">غير معتمدة</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-4 space-y-2">{Array.from({length:5}).map((_,i)=>(<Skeleton key={i} className="h-10"/>))}</CardContent></Card>
      ) : (
        <HierarchicalTree
          items={filtered}
          getClassId={(a:any) => a.exams?.class_id ?? a.students?.class_id ?? null}
          getClassName={(a:any) => (classes ?? []).find((c:any)=>c.id === (a.exams?.class_id ?? a.students?.class_id))?.name ?? "بدون صف"}
          getGroupId={(a:any) => a.exam_id}
          getGroupName={(a:any) => a.exams?.title ?? "امتحان"}
          itemsLabel={(n) => `${n} نتيجة`}
          emptyLabel="لا توجد نتائج مطابقة"
          renderClassStats={(list) => {
            const arr = list.map((a:any)=>Number(a.percentage)||0);
            const avg = arr.length ? Math.round(arr.reduce((s,v)=>s+v,0)/arr.length) : 0;
            return <div className="text-xs text-muted-foreground">متوسط {avg}%</div>;
          }}
          renderGroupStats={(list) => {
            const arr = list.map((a:any)=>Number(a.percentage)||0);
            const avg = arr.length ? Math.round(arr.reduce((s,v)=>s+v,0)/arr.length) : 0;
            const pass = arr.length ? Math.round((arr.filter(v=>v>=50).length/arr.length)*100) : 0;
            return <div className="text-xs text-muted-foreground">متوسط {avg}% — نجاح {pass}%</div>;
          }}
          renderItem={(a:any) => {
            const pct = Number(a.percentage) || 0;
            const waVars = {
              name: a.students?.full_name ?? "",
              exam: a.exams?.title ?? "",
              score: a.score ?? 0,
              total: a.total ?? 0,
              percentage: pct,
              grade_text: a.grade ?? computeGrade(pct),
            };
            const tone =
              pct >= 85 ? "bg-success text-success-foreground" :
              pct >= 65 ? "bg-primary text-primary-foreground" :
              pct >= 50 ? "bg-warning text-warning-foreground" :
              "bg-destructive text-destructive-foreground";
            return (
              <div className="flex items-center gap-3 p-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  {a.students?.id ? (
                    <Link to="/admin/students/$id" params={{ id: a.students.id }} className="hover:underline font-medium">
                      {a.students?.full_name ?? "—"}
                    </Link>
                  ) : (a.students?.full_name ?? "—")}
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                    <span className="font-mono">{a.students?.code ?? "—"}</span>
                    <span>{a.score} / {a.total}</span>
                    <span>{formatArabicDate(a.submitted_at ?? a.created_at)}</span>
                    <span>{formatDuration(a.time_spent_sec ?? 0)}</span>
                  </div>
                </div>
                <Badge className={tone}>{pct}%</Badge>
                <Badge variant="secondary">{a.grade ?? computeGrade(pct)}</Badge>
                {a.approved
                  ? <Badge className="bg-gold text-gold-foreground"><ShieldCheck className="h-3 w-3 ml-1 inline"/>معتمدة</Badge>
                  : <Badge variant="outline">قيد المراجعة</Badge>}
                {a.exams?.id && (
                  <Button asChild size="sm" variant="default" className="gap-1">
                    <Link to="/admin/exams/$id/results" params={{ id: a.exams.id }} search={{ attempt: a.id }}>
                      <FileEdit className="h-3.5 w-3.5" />مراجعة
                    </Link>
                  </Button>
                )}
                <WhatsAppButton
                  phone={a.students?.parent_whatsapp ?? a.students?.parent_phone}
                  template={pickResultTemplate(pct)}
                  vars={waVars}
                  size="icon"
                  variant="ghost"
                />
              </div>
            );
          }}
        />
      )}

    </div>
  );
}
