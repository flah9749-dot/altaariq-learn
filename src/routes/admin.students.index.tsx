import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users, Plus, Search, Download, Upload, Trash2, Ban, CheckCircle2,
  Archive, GraduationCap, ChevronDown, Layers, TrendingUp, TrendingDown,
  UserCheck, UserX, Activity, Sparkles, Filter, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { StudentFormDialog } from "@/components/students/StudentFormDialog";
import { ImportStudentsDialog } from "@/components/students/ImportStudentsDialog";
import { StudentRichCard } from "@/components/students/StudentRichCard";
import { deleteStudents, toggleStudentStatus } from "@/lib/students.functions";
import { archiveStudents } from "@/lib/archive.functions";
import { getStudentsOverview, type StudentOverviewRow } from "@/lib/students-overview.functions";
import { useDebounce } from "@/hooks/use-debounce";

export const Route = createFileRoute("/admin/students/")({
  head: () => ({ meta: [{ title: "الطلاب — لوحة المدرس" }] }),
  component: StudentsPage,
});

const NO_CLASS = "__no_class__";
const NO_GROUP = "__no_group__";

type ExamFilter = "" | "attended_last" | "missed_last" | "never_attempted" | "high_scores" | "low_scores" | "absent_3plus" | "absent_5plus";
type InactiveFilter = "" | "3" | "7" | "14" | "30";
type SortMode = "name" | "avg_desc" | "avg_asc" | "attempts_desc" | "attendance_desc";

function StudentsPage() {
  const qc = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "suspended">("");
  const [examFilter, setExamFilter] = useState<ExamFilter>("");
  const [inactiveFilter, setInactiveFilter] = useState<InactiveFilter>("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [showFilters, setShowFilters] = useState(false);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[] } | null>(null);
  const [archiveState, setArchiveState] = useState<{ ids: string[] } | null>(null);
  const [archiveYear, setArchiveYear] = useState(String(new Date().getFullYear()));

  const debouncedSearch = useDebounce(search, 300);

  const delFn = useServerFn(deleteStudents);
  const toggleFn = useServerFn(toggleStudentStatus);
  const archiveFn = useServerFn(archiveStudents);
  const overviewFn = useServerFn(getStudentsOverview);

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
    staleTime: 60_000,
  });
  const { data: groups } = useQuery({
    queryKey: ["groups-list"],
    queryFn: async () => (await supabase.from("groups").select("id,name,class_id").order("name")).data ?? [],
    staleTime: 60_000,
  });

  const { data: rowsRaw, isLoading } = useQuery({
    queryKey: ["students-overview", classFilter, groupFilter, statusFilter],
    queryFn: () => overviewFn({
      data: {
        class_id: classFilter || null,
        group_id: groupFilter || null,
        status: statusFilter || null,
      },
    }),
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["students-overview"] });
  };

  const deleteMut = useMutation({
    mutationFn: async (ids: string[]) => delFn({ data: { ids } }),
    onSuccess: (r: any) => {
      toast.success(`تم حذف ${r.count} طالب`);
      invalidate();
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: "active" | "suspended" }) =>
      toggleFn({ data: { ids, status } }),
    onSuccess: () => { toast.success("تم تحديث الحالة"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التحديث"),
  });

  const archiveMut = useMutation({
    mutationFn: async ({ ids, year }: { ids: string[]; year: string }) => archiveFn({ data: { ids, year } }),
    onSuccess: (r: any) => {
      toast.success(`تم أرشفة ${r.count} طالب`);
      invalidate();
      setArchiveState(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الأرشفة"),
  });

  // Client-side search + advanced filters + sort
  const rows = useMemo(() => {
    const src = rowsRaw ?? [];
    const q = debouncedSearch.trim().toLowerCase();
    let filtered = src.filter((s) => {
      if (q) {
        const hay = [
          s.full_name, s.code, s.phone ?? "", s.parent_name ?? "",
          s.parent_phone ?? "", s.parent_whatsapp ?? "",
          s.class_name ?? "", s.group_name ?? "",
        ].join("|").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (examFilter === "attended_last" && (!s.last_exam_id || !s.last_exam_attended)) return false;
      if (examFilter === "missed_last" && (!s.last_exam_id || s.last_exam_attended)) return false;
      if (examFilter === "never_attempted" && s.attended_count > 0) return false;
      if (examFilter === "high_scores" && Number(s.avg_percentage) < 80) return false;
      if (examFilter === "low_scores" && (s.attended_count === 0 || Number(s.avg_percentage) >= 50)) return false;
      if (examFilter === "absent_3plus" && s.absent_count < 3) return false;
      if (examFilter === "absent_5plus" && s.absent_count < 5) return false;
      if (inactiveFilter) {
        const threshold = Number(inactiveFilter);
        if (!s.last_seen) return true;
        const days = (Date.now() - new Date(s.last_seen).getTime()) / 86400000;
        if (days < threshold) return false;
      }
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "avg_desc": return Number(b.avg_percentage) - Number(a.avg_percentage);
        case "avg_asc": return Number(a.avg_percentage) - Number(b.avg_percentage);
        case "attempts_desc": return b.attended_count - a.attended_count;
        case "attendance_desc": {
          const ra = a.scheduled_count ? a.attended_count / a.scheduled_count : 0;
          const rb = b.scheduled_count ? b.attended_count / b.scheduled_count : 0;
          return rb - ra;
        }
        default: return a.full_name.localeCompare(b.full_name, "ar");
      }
    });
    return filtered;
  }, [rowsRaw, debouncedSearch, examFilter, inactiveFilter, sortMode]);

  // Dashboard stats (from unfiltered raw, respects only scope filters)
  const stats = useMemo(() => computeStats(rowsRaw ?? []), [rowsRaw]);

  // Grouped by class → group
  const buckets = useMemo(() => bucketize(rows), [rows]);

  const activeFiltersCount =
    (examFilter ? 1 : 0) + (inactiveFilter ? 1 : 0) + (sortMode !== "name" ? 1 : 0);

  const clearAdvancedFilters = () => {
    setExamFilter(""); setInactiveFilter(""); setSortMode("name");
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const data = rows.map((r) => ({
      "الاسم": r.full_name, "الكود": r.code, "الصف": r.class_name ?? "",
      "المجموعة": r.group_name ?? "", "الهاتف": r.phone ?? "",
      "ولي الأمر": r.parent_name ?? "", "هاتف ولي الأمر": r.parent_phone ?? "",
      "الحالة": r.status === "active" ? "نشط" : "موقوف",
      "امتحانات متاحة": r.scheduled_count, "حضر": r.attended_count, "غاب": r.absent_count,
      "المتوسط %": r.attended_count > 0 ? Math.round(Number(r.avg_percentage)) : "",
      "آخر امتحان": r.last_exam_title ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
    XLSX.writeFile(wb, `students-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const openEdit = async (s: StudentOverviewRow) => {
    const { data } = await supabase
      .from("students")
      .select("*, classes(id,name), groups(id,name)")
      .eq("id", s.id)
      .maybeSingle();
    setEditStudent(data);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> إدارة الطلاب
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            منصة الامتحانات — الإجمالي: <span className="font-semibold text-foreground">{stats.total}</span> طالب
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 ml-1" />استيراد
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4 ml-1" />تصدير
          </Button>
          <Button size="sm" onClick={() => { setEditStudent(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 ml-1" />إضافة طالب
          </Button>
        </div>
      </div>

      {/* Dashboard stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="إجمالي الطلاب" value={stats.total} color="primary" />
        <StatCard icon={Layers} label="الامتحانات" value={stats.totalExams} color="primary" />
        <StatCard icon={UserCheck} label="حضروا الأخير" value={stats.attendedLast} color="success" />
        <StatCard icon={UserX} label="غابوا عن الأخير" value={stats.missedLast} color="danger" />
        <StatCard icon={TrendingUp} label="متوسط الدرجات" value={`${stats.avgScore}%`} color="primary" />
        <StatCard icon={Activity} label="نشطون اليوم" value={stats.activeToday} color="success" />
        <StatCard icon={Sparkles} label="أعلى طالب" value={stats.topName ?? "—"} subValue={stats.topScore != null ? `${stats.topScore}%` : ""} color="success" small />
        <StatCard icon={TrendingDown} label="أقل طالب" value={stats.lowName ?? "—"} subValue={stats.lowScore != null ? `${stats.lowScore}%` : ""} color="danger" small />
        <StatCard icon={UserX} label="غير نشط 7+ أيام" value={stats.inactive7} color="warning" />
      </div>

      {/* Search + core filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم، الكود، الهاتف، ولي الأمر..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={classFilter || "all"} onValueChange={(v) => { setClassFilter(v === "all" ? "" : v); setGroupFilter(""); }}>
              <SelectTrigger><SelectValue placeholder="كل الصفوف" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الصفوف</SelectItem>
                {(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={groupFilter || "all"} onValueChange={(v) => setGroupFilter(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="كل المجموعات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المجموعات</SelectItem>
                {(groups ?? []).filter((g) => !classFilter || g.class_id === classFilter).map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4 ml-1" />
              فلاتر متقدمة
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="mr-1 text-[10px]">{activeFiltersCount}</Badge>
              )}
            </Button>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v as any)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="suspended">موقوف</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground mr-auto">
              عرض <span className="font-semibold text-foreground">{rows.length}</span> من {stats.total}
            </div>
          </div>

          {showFilters && (
            <div className="grid gap-3 md:grid-cols-3 pt-2 border-t">
              <div>
                <Label className="text-[11px] text-muted-foreground">حالة الامتحانات</Label>
                <Select value={examFilter || "all"} onValueChange={(v) => setExamFilter(v === "all" ? "" : v as ExamFilter)}>
                  <SelectTrigger><SelectValue placeholder="الجميع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الجميع</SelectItem>
                    <SelectItem value="attended_last">حضر آخر امتحان</SelectItem>
                    <SelectItem value="missed_last">غاب عن آخر امتحان</SelectItem>
                    <SelectItem value="never_attempted">لم يدخل أي امتحان</SelectItem>
                    <SelectItem value="high_scores">درجات مرتفعة (80%+)</SelectItem>
                    <SelectItem value="low_scores">درجات منخفضة (&lt;50%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">لم يدخل المنصة منذ</Label>
                <Select value={inactiveFilter || "all"} onValueChange={(v) => setInactiveFilter(v === "all" ? "" : v as InactiveFilter)}>
                  <SelectTrigger><SelectValue placeholder="أي وقت" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">أي وقت</SelectItem>
                    <SelectItem value="3">3 أيام أو أكثر</SelectItem>
                    <SelectItem value="7">أسبوع أو أكثر</SelectItem>
                    <SelectItem value="14">أسبوعين أو أكثر</SelectItem>
                    <SelectItem value="30">شهر أو أكثر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">الترتيب</Label>
                <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">الاسم (أبجديًا)</SelectItem>
                    <SelectItem value="avg_desc">أعلى الدرجات</SelectItem>
                    <SelectItem value="avg_asc">أقل الدرجات</SelectItem>
                    <SelectItem value="attempts_desc">الأكثر امتحانات</SelectItem>
                    <SelectItem value="attendance_desc">الأكثر التزامًا</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {activeFiltersCount > 0 && (
                <div className="md:col-span-3">
                  <Button variant="ghost" size="sm" onClick={clearAdvancedFilters}>
                    <X className="h-4 w-4 ml-1" />مسح الفلاتر المتقدمة
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hierarchy */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : buckets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            {(rowsRaw?.length ?? 0) === 0
              ? "لا يوجد طلاب بعد. ابدأ بإضافة طالب من الأعلى."
              : "لا نتائج مطابقة للفلاتر الحالية."}
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={buckets.slice(0, 2).map((c) => c.id)}
          className="space-y-3"
        >
          {buckets.map((cls) => (
            <AccordionItem
              key={cls.id}
              value={cls.id}
              className="border-2 rounded-xl bg-card shadow-sm overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-3 flex-1 text-right">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base md:text-lg truncate">{cls.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{cls.groups.length} مجموعة</span>
                      <span>•</span>
                      <span className="font-semibold text-primary">{cls.total} طالب</span>
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
              </AccordionTrigger>
              <AccordionContent className="pb-4 px-4 pt-0">
                <Accordion
                  type="multiple"
                  defaultValue={cls.groups.slice(0, 1).map((g) => `${cls.id}-${g.id}`)}
                  className="space-y-2"
                >
                  {cls.groups.map((grp) => (
                    <AccordionItem
                      key={grp.id}
                      value={`${cls.id}-${grp.id}`}
                      className="border rounded-lg bg-muted/20 overflow-hidden"
                    >
                      <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/40">
                        <div className="flex items-center gap-2 flex-1 text-right">
                          <div className="h-7 w-7 rounded-md bg-secondary/40 text-secondary-foreground flex items-center justify-center shrink-0 text-xs font-bold">
                            {grp.students.length}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{grp.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              متوسط الحضور: {grp.attendanceRate}%
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                          {grp.students.map((s) => (
                            <StudentRichCard
                              key={s.id}
                              s={s}
                              onEdit={openEdit}
                              onDelete={(ids) => setConfirmDelete({ ids })}
                              onToggleStatus={(ids, status) => toggleMut.mutate({ ids, status })}
                            />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Dialogs */}
      <StudentFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) invalidate(); }}
        student={editStudent}
      />
      <ImportStudentsDialog
        open={importOpen}
        onOpenChange={(o) => { setImportOpen(o); if (!o) invalidate(); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف {confirmDelete?.ids.length} طالب نهائيًا مع جميع بياناتهم. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.ids)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!archiveState} onOpenChange={(o) => !o && setArchiveState(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>أرشفة الطلاب</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>العام الدراسي</Label>
            <Input value={archiveYear} onChange={(e) => setArchiveYear(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveState(null)}>إلغاء</Button>
            <Button onClick={() => archiveState && archiveMut.mutate({ ids: archiveState.ids, year: archiveYear })}>
              أرشفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= helpers =============

function StatCard({
  icon: Icon, label, value, subValue, color, small,
}: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  color: "primary" | "success" | "danger" | "warning";
  small?: boolean;
}) {
  const cls =
    color === "success" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" :
    color === "danger"  ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" :
    color === "warning" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" :
                          "bg-primary/10 text-primary border-primary/20";
  return (
    <Card className="p-3 border-2 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-2">
        <div className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${cls}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
          <div className={`font-bold leading-tight mt-0.5 truncate ${small ? "text-sm" : "text-lg"}`}>{value}</div>
          {subValue && <div className="text-[10px] text-muted-foreground">{subValue}</div>}
        </div>
      </div>
    </Card>
  );
}

function computeStats(all: StudentOverviewRow[]) {
  const total = all.length;
  const totalExamsMap = new Set<string>();
  for (const s of all) if (s.last_exam_id) totalExamsMap.add(s.last_exam_id);

  let attendedLast = 0, missedLast = 0, sumPct = 0, sumPctCount = 0;
  let activeToday = 0, inactive7 = 0;
  let topName: string | null = null, topScore: number | null = null;
  let lowName: string | null = null, lowScore: number | null = null;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (const s of all) {
    if (s.last_exam_id) {
      if (s.last_exam_attended) attendedLast++;
      else missedLast++;
    }
    if (s.attended_count > 0) {
      const p = Number(s.avg_percentage);
      sumPct += p; sumPctCount++;
      if (topScore == null || p > topScore) { topScore = p; topName = s.full_name; }
      if (lowScore == null || p < lowScore) { lowScore = p; lowName = s.full_name; }
    }
    if (s.last_seen) {
      const seen = new Date(s.last_seen);
      const days = (Date.now() - seen.getTime()) / 86400000;
      if (seen >= today) activeToday++;
      if (days >= 7) inactive7++;
    } else {
      inactive7++;
    }
  }

  return {
    total,
    totalExams: totalExamsMap.size,
    attendedLast,
    missedLast,
    avgScore: sumPctCount > 0 ? Math.round(sumPct / sumPctCount) : 0,
    activeToday,
    inactive7,
    topName, topScore: topScore != null ? Math.round(topScore) : null,
    lowName, lowScore: lowScore != null ? Math.round(lowScore) : null,
  };
}

type GroupBucket = {
  id: string;
  name: string;
  students: StudentOverviewRow[];
  attendanceRate: number;
};
type ClassBucket = {
  id: string;
  name: string;
  groups: GroupBucket[];
  total: number;
};

function bucketize(rows: StudentOverviewRow[]): ClassBucket[] {
  const map = new Map<string, ClassBucket>();
  for (const s of rows) {
    const cId = s.class_id ?? NO_CLASS;
    const cName = s.class_name ?? "بدون صف";
    const gId = s.group_id ?? NO_GROUP;
    const gName = s.group_name ?? "بدون مجموعة";
    let cls = map.get(cId);
    if (!cls) { cls = { id: cId, name: cName, groups: [], total: 0 }; map.set(cId, cls); }
    let grp = cls.groups.find((g) => g.id === gId);
    if (!grp) { grp = { id: gId, name: gName, students: [], attendanceRate: 0 }; cls.groups.push(grp); }
    grp.students.push(s);
    cls.total++;
  }
  const arr = [...map.values()];
  arr.sort((a, b) => {
    if (a.id === NO_CLASS) return 1;
    if (b.id === NO_CLASS) return -1;
    return a.name.localeCompare(b.name, "ar");
  });
  for (const c of arr) {
    c.groups.sort((a, b) => {
      if (a.id === NO_GROUP) return 1;
      if (b.id === NO_GROUP) return -1;
      return a.name.localeCompare(b.name, "ar");
    });
    for (const g of c.groups) {
      // compute attendance rate for group
      let sched = 0, att = 0;
      for (const s of g.students) { sched += s.scheduled_count; att += s.attended_count; }
      g.attendanceRate = sched > 0 ? Math.round((att / sched) * 100) : 0;
    }
  }
  return arr;
}
