import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileText, Plus, Sparkles, Search, MoreHorizontal, Edit, Eye, Trash2,
  CheckCircle2, XCircle, BarChart3, Clock, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HierarchicalTree } from "@/components/common/HierarchicalTree";
import { deleteExam, publishExam, upsertExam } from "@/lib/exams.functions";
import { STATUS_COLOR, STATUS_LABEL, deriveStatus } from "@/lib/exam-utils";
import { formatArabicDate } from "@/lib/students-utils";


export const Route = createFileRoute("/admin/exams/")({
  head: () => ({ meta: [{ title: "الامتحانات — لوحة المدرس" }] }),
  component: ExamsPage,
});

function ExamsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const delFn = useServerFn(deleteExam);
  const pubFn = useServerFn(publishExam);
  const createFn = useServerFn(upsertExam);

  const { data: exams, isLoading } = useQuery({
    queryKey: ["admin-exams", search],
    queryFn: async () => {
      let q = supabase.from("exams").select("*, classes(id,name)").order("created_at", { ascending: false });
      if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const examIds = useMemo(() => (exams ?? []).map((e) => e.id), [exams]);
  const { data: stats } = useQuery({
    queryKey: ["admin-exam-stats", examIds],
    enabled: examIds.length > 0,
    queryFn: async () => {
      const [{ data: qs }, { data: atts }] = await Promise.all([
        supabase.from("questions").select("exam_id").in("exam_id", examIds),
        supabase.from("exam_attempts").select("exam_id,percentage,status").in("exam_id", examIds),
      ]);
      const map: Record<string, { q: number; students: number; avg: number; pass: number }> = {};
      for (const id of examIds) map[id] = { q: 0, students: 0, avg: 0, pass: 0 };
      for (const q of qs ?? []) map[q.exam_id].q++;
      const byExam: Record<string, number[]> = {};
      for (const a of atts ?? []) {
        if (a.status === "in_progress") continue;
        (byExam[a.exam_id] ??= []).push(Number(a.percentage) || 0);
      }
      for (const [id, arr] of Object.entries(byExam)) {
        map[id].students = arr.length;
        map[id].avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        map[id].pass = arr.length ? Math.round((arr.filter((p) => p >= 50).length / arr.length) * 100) : 0;
      }
      return map;
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["admin-exams"] }); setConfirmDel(null); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });
  const pubMut = useMutation({
    mutationFn: async (v: { id: string; published: boolean }) => pubFn({ data: v }),
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["admin-exams"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التحديث"),
  });

  const createBlank = async () => {
    try {
      const res = await createFn({ data: { patch: { title: "امتحان جديد" } } });
      nav({ to: "/admin/exams/$id", params: { id: (res as any).id } });
    } catch (e: any) { toast.error(e?.message ?? "فشل الإنشاء"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> إدارة الامتحانات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">الإجمالي: {(exams ?? []).length} امتحان</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/exams/ai"><Sparkles className="h-4 w-4 ml-1" />إنشاء بالذكاء الاصطناعي</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
            <Link to="/admin/exams/map/new">🗺️ امتحان خرائط ذكي</Link>
          </Button>
          <Button size="sm" onClick={createBlank}><Plus className="h-4 w-4 ml-1" />امتحان جديد</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">بحث</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث بعنوان الامتحان..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-4 space-y-2">{Array.from({length:4}).map((_,i)=>(<Skeleton key={i} className="h-14"/>))}</CardContent></Card>
      ) : (
        <HierarchicalTree
          items={exams ?? []}
          getClassId={(e:any) => e.class_id}
          getClassName={(e:any) => e.classes?.name ?? "بدون صف"}
          itemsLabel={(n) => `${n} امتحان`}
          emptyLabel="لا يوجد امتحانات بعد"
          renderClassStats={(list) => {
            const published = list.filter((e:any)=>e.published).length;
            return <div className="text-xs text-muted-foreground">{published} منشور من {list.length}</div>;
          }}
          renderItem={(e:any) => {
            const s = deriveStatus(e as any);
            const st = stats?.[e.id];
            return (
              <div className="flex items-center gap-3 p-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Link to="/admin/exams/$id" params={{ id: e.id }} className="font-medium hover:underline">{e.title}</Link>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                    <span>{e.subject ?? "—"}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{e.duration_minutes} د</span>
                    <span>{Number(e.total_score)||0} درجة</span>
                    <span>{formatArabicDate(e.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">أسئلة: {st?.q ?? 0}</Badge>
                  <Badge variant="outline"><Users className="h-3 w-3 ml-1"/>{st?.students ?? 0}</Badge>
                  <Badge variant="outline">م: {st?.avg ?? 0}%</Badge>
                  <Badge variant="outline">نجاح: {st?.pass ?? 0}%</Badge>
                  <Badge className={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link to="/admin/exams/$id" params={{ id: e.id }}><Edit className="h-4 w-4 ml-2" />تعديل</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/admin/exams/$id/results" params={{ id: e.id }} search={{ attempt: undefined }}><BarChart3 className="h-4 w-4 ml-2" />التقارير</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => pubMut.mutate({ id: e.id, published: !e.published })}>
                      {e.published ? <><XCircle className="h-4 w-4 ml-2" />إلغاء النشر</> : <><CheckCircle2 className="h-4 w-4 ml-2" />نشر</>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDel(e.id)}><Trash2 className="h-4 w-4 ml-2" />حذف</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }}
        />
      )}


      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الامتحان</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف الامتحان وكل أسئلته ونتائجه.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => confirmDel && delMut.mutate(confirmDel)}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
