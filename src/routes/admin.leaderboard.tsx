import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Filter, Medal, TrendingUp, Users, GraduationCap, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToExcel } from "@/lib/reports";
import { SectionTabs } from "@/components/admin/SectionTabs";

export const Route = createFileRoute("/admin/leaderboard")({
  head: () => ({ meta: [{ title: "ترتيب الطلاب — الطارق التعليمية" }] }),
  component: LeaderboardPage,
});

type SortKey = "points" | "total_score" | "avg_score" | "pass_rate";

function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<SortKey>("points");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [period, setPeriod] = useState<"all" | "30" | "7">("all");

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [] });
  const { data: groups } = useQuery({ queryKey: ["groups"], queryFn: async () => (await supabase.from("groups").select("id,name").order("name")).data ?? [] });

  const { data: students, isLoading } = useQuery({
    queryKey: ["lb-students", classFilter, groupFilter],
    queryFn: async () => {
      let q = supabase.from("students").select("id,full_name,code,points,level,avatar_url,class_id,group_id,classes(name),groups(name)").eq("status", "active");
      if (classFilter !== "all") q = q.eq("class_id", classFilter);
      if (groupFilter !== "all") q = q.eq("group_id", groupFilter);
      return (await q).data ?? [];
    },
  });

  const { data: attempts } = useQuery({
    queryKey: ["lb-attempts", period],
    queryFn: async () => {
      let q = supabase.from("exam_attempts").select("student_id,percentage,score,total,approved,submitted_at").eq("approved", true);
      if (period !== "all") {
        const since = new Date(Date.now() - Number(period) * 24 * 3600 * 1000).toISOString();
        q = q.gte("submitted_at", since);
      }
      return (await q).data ?? [];
    },
  });

  const rows = useMemo(() => {
    const byStudent = new Map<string, any[]>();
    (attempts ?? []).forEach((a: any) => {
      const arr = byStudent.get(a.student_id) ?? [];
      arr.push(a); byStudent.set(a.student_id, arr);
    });
    return (students ?? []).map((s: any) => {
      const list = byStudent.get(s.id) ?? [];
      const total = list.reduce((sum, a) => sum + (Number(a.score) || 0), 0);
      const avg = list.length ? Math.round(list.reduce((sum, a) => sum + Number(a.percentage), 0) / list.length) : 0;
      const pass = list.length ? Math.round((list.filter((a: any) => Number(a.percentage) >= 50).length / list.length) * 100) : 0;
      return { ...s, total_score: total, avg_score: avg, pass_rate: pass, exam_count: list.length };
    }).sort((a: any, b: any) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));
  }, [students, attempts, sortBy]);

  const doExport = () => {
    exportToExcel(rows.map((r: any, i: number) => ({
      "الترتيب": i + 1, "الاسم": r.full_name, "الكود": r.code, "الصف": r.classes?.name ?? "",
      "المجموعة": r.groups?.name ?? "", "النقاط": r.points, "المستوى": r.level,
      "إجمالي الدرجات": r.total_score, "متوسط الدرجات": `${r.avg_score}%`, "نسبة النجاح": `${r.pass_rate}%`,
    })), `ترتيب-الطلاب-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const rankColor = (i: number) => i === 0 ? "text-gold" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground";

  return (
    <div className="space-y-6">
      <SectionTabs items={[{ to: "/admin/reports", label: "التقارير" }, { to: "/admin/leaderboard", label: "ترتيب الطلاب" }]} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-7 w-7 text-gold" />ترتيب الطلاب
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Leaderboard مبني على النقاط والامتحانات المعتمدة</p>
        </div>
        <Button onClick={doExport} variant="outline"><Download className="h-4 w-4 ml-1" />تصدير Excel</Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="ترتيب حسب" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="points">النقاط</SelectItem>
              <SelectItem value="total_score">إجمالي الدرجات</SelectItem>
              <SelectItem value="avg_score">متوسط الدرجات</SelectItem>
              <SelectItem value="pass_rate">نسبة النجاح</SelectItem>
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="الصف" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الصفوف</SelectItem>
              {(classes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="المجموعة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المجموعات</SelectItem>
              {(groups ?? []).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="الفترة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفترات</SelectItem>
              <SelectItem value="30">آخر 30 يوم</SelectItem>
              <SelectItem value="7">آخر 7 أيام</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Podium */}
      {rows.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[rows[1], rows[0], rows[2]].map((s: any, idx: number) => {
            const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
            return (
              <Card key={s.id} className={`text-center ${rank === 1 ? "border-gold border-2 md:scale-110" : ""}`}>
                <CardContent className="p-4">
                  <Medal className={`h-8 w-8 mx-auto ${rankColor(rank - 1)}`} />
                  <p className="font-bold mt-2">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.classes?.name ?? ""}</p>
                  <p className="text-2xl font-bold mt-2">{s[sortBy]}{sortBy === "avg_score" || sortBy === "pass_rate" ? "%" : ""}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>الترتيب الكامل</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>الطالب</TableHead><TableHead>الصف</TableHead><TableHead>المجموعة</TableHead>
              <TableHead><TrendingUp className="h-4 w-4 inline"/> النقاط</TableHead>
              <TableHead>إجمالي الدرجات</TableHead>
              <TableHead>المتوسط</TableHead>
              <TableHead>نسبة النجاح</TableHead>
              <TableHead>عدد الامتحانات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? Array.from({length:5}).map((_,i)=> <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-8"/></TableCell></TableRow>) :
               rows.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا يوجد طلاب</TableCell></TableRow> :
               rows.map((r: any, i: number) => (
                <TableRow key={r.id}>
                  <TableCell><Badge variant={i < 3 ? "default" : "outline"} className={i < 3 ? rankColor(i) : ""}>{i + 1}</Badge></TableCell>
                  <TableCell><Link to="/admin/students/$id" params={{ id: r.id }} className="hover:underline font-medium">{r.full_name}</Link></TableCell>
                  <TableCell className="text-xs">{r.classes?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.groups?.name ?? "—"}</TableCell>
                  <TableCell className="font-bold text-primary">{r.points}</TableCell>
                  <TableCell>{r.total_score}</TableCell>
                  <TableCell>{r.avg_score}%</TableCell>
                  <TableCell>{r.pass_rate}%</TableCell>
                  <TableCell>{r.exam_count}</TableCell>
                </TableRow>
               ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
