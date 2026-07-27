import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users, Plus, Search, Download, Upload, Layers, GraduationCap,
  ChevronRight, TrendingUp, UserCheck, UserX, AlertTriangle, Sparkles,
  Loader2, Eye, Edit, MessageCircle, Trophy, ExternalLink, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { StudentFormDialog } from "@/components/students/StudentFormDialog";
import { ImportStudentsDialog } from "@/components/students/ImportStudentsDialog";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import {
  treeListClasses, treeListGroups, treeListStudents,
  type TreeClassRow, type TreeGroupRow, type TreeStudentRow,
} from "@/lib/students-overview.functions";
import { useDebounce } from "@/hooks/use-debounce";

export const Route = createFileRoute("/admin/students/")({
  head: () => ({
    meta: [
      { title: "الطلاب — لوحة المدرس" },
      { name: "description", content: "شجرة الصفوف والمجموعات والطلاب مع تحميل كسول." },
      { property: "og:title", content: "الطلاب — لوحة المدرس" },
      { property: "og:description", content: "إدارة الطلاب بنظام شجرة هرمية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentsTreePage,
});

function StudentsTreePage() {
  const [openClasses, setOpenClasses] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<TreeStudentRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<TreeStudentRow | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const listClasses = useServerFn(treeListClasses);
  const { data: classes, isLoading: loadingClasses } = useQuery({
    queryKey: ["tree", "classes"],
    queryFn: () => listClasses({ data: undefined as never }),
    staleTime: 60_000,
  });

  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    if (!debouncedSearch.trim()) return classes;
    const q = debouncedSearch.trim().toLowerCase();
    return classes.filter((c) => c.class_name.toLowerCase().includes(q));
  }, [classes, debouncedSearch]);

  const totals = useMemo(() => {
    const cs = classes ?? [];
    return {
      classes: cs.length,
      students: cs.reduce((a, c) => a + c.students_count, 0),
      chronic: cs.reduce((a, c) => a + c.chronic_absent_count, 0),
      top: cs.reduce((a, c) => a + c.top_count, 0),
    };
  }, [classes]);

  const toggleClass = (id: string) => {
    setOpenClasses((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" /> الطلاب
          </h1>
          <p className="text-xs text-muted-foreground mt-1">اضغط على صف لعرض مجموعاته، ثم على مجموعة لعرض طلابها.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> إضافة طالب</Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2"><Upload className="h-4 w-4" /> استيراد</Button>
          <Button variant="outline" asChild className="gap-2"><a href="/admin/students/export"><Download className="h-4 w-4" /> تصدير</a></Button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={GraduationCap} label="عدد الصفوف" value={totals.classes} color="text-primary" />
        <Kpi icon={Users} label="إجمالي الطلاب" value={totals.students} color="text-blue-500" />
        <Kpi icon={Trophy} label="متفوقون (80%+)" value={totals.top} color="text-amber-500" />
        <Kpi icon={AlertTriangle} label="غياب مزمن (3+)" value={totals.chronic} color="text-red-500" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن صف…"
          className="pr-9"
        />
        {search && (
          <Button size="icon" variant="ghost" className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tree */}
      <div className="space-y-2">
        {loadingClasses && (
          <>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        )}
        {!loadingClasses && filteredClasses.length === 0 && (
          <EmptyState
            icon={GraduationCap}
            title="لا توجد صفوف بعد"
            hint="أنشئ الصفوف من قائمة الإعدادات، أو أضف أول طالب لينشأ الصف تلقائيًا."
          />
        )}
        {filteredClasses.map((c) => (
          <ClassNode
            key={c.class_id}
            row={c}
            open={openClasses.has(c.class_id)}
            openGroups={openGroups}
            onToggle={() => toggleClass(c.class_id)}
            onToggleGroup={toggleGroup}
            onSelectStudent={setSelectedStudent}
          />
        ))}
      </div>

      {/* Add/Import dialogs */}
      <StudentFormDialog open={addOpen} onOpenChange={setAddOpen} />
      <StudentFormDialog
        open={!!editStudent}
        onOpenChange={(v) => !v && setEditStudent(null)}
        student={editStudent ? mapToStudentForm(editStudent) : undefined}
      />
      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Student drawer */}
      <StudentDrawer
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
        onEdit={(s) => { setSelectedStudent(null); setEditStudent(s); }}
      />
    </div>
  );
}

/* ─────────────────────────── Class Node ─────────────────────────── */

function ClassNode({
  row, open, openGroups, onToggle, onToggleGroup, onSelectStudent,
}: {
  row: TreeClassRow;
  open: boolean;
  openGroups: Set<string>;
  onToggle: () => void;
  onToggleGroup: (id: string) => void;
  onSelectStudent: (s: TreeStudentRow) => void;
}) {
  const listGroups = useServerFn(treeListGroups);
  const { data: groups, isFetching } = useQuery({
    queryKey: ["tree", "groups", row.class_id],
    queryFn: () => listGroups({ data: { class_id: row.class_id } }),
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <Card className="overflow-hidden border-2 border-border/60">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-right"
      >
        <ChevronRight className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-90 rtl:-rotate-90" : "rotate-180 rtl:rotate-0"} text-primary`} />
        <GraduationCap className="h-6 w-6 text-primary shrink-0" />
        <div className="flex-1 min-w-0 text-right">
          <div className="font-bold text-base sm:text-lg truncate">{row.class_name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {row.students_count} طالب • متوسط {fmtPct(row.avg_percentage)} • حضور {fmtPct(row.attendance_rate)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          {row.chronic_absent_count > 0 && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertTriangle className="h-3 w-3" /> غياب مزمن {row.chronic_absent_count}
            </Badge>
          )}
          {row.top_count > 0 && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[10px]" variant="outline">
              <Trophy className="h-3 w-3" /> {row.top_count}
            </Badge>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t bg-muted/20 p-2 space-y-2">
          {isFetching && !groups && (
            <><Skeleton className="h-12" /><Skeleton className="h-12" /></>
          )}
          {groups && groups.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">لا توجد مجموعات في هذا الصف.</div>
          )}
          {groups?.map((g) => (
            <GroupNode
              key={g.group_id}
              classId={row.class_id}
              row={g}
              open={openGroups.has(g.group_id)}
              onToggle={() => onToggleGroup(g.group_id)}
              onSelectStudent={onSelectStudent}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────── Group Node ─────────────────────────── */

function GroupNode({
  classId, row, open, onToggle, onSelectStudent,
}: {
  classId: string;
  row: TreeGroupRow;
  open: boolean;
  onToggle: () => void;
  onSelectStudent: (s: TreeStudentRow) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const listStudents = useServerFn(treeListStudents);

  const { data: students, isFetching } = useQuery({
    queryKey: ["tree", "students", classId, row.group_id, debounced],
    queryFn: () => listStudents({
      data: {
        class_id: classId,
        group_id: row.group_id,
        search: debounced || null,
        limit: 300,
        offset: 0,
      },
    }),
    enabled: open,
    staleTime: 30_000,
  });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors text-right"
      >
        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90 rtl:-rotate-90" : "rotate-180 rtl:rotate-0"} text-secondary-foreground`} />
        <Layers className="h-5 w-5 text-secondary-foreground shrink-0" />
        <div className="flex-1 min-w-0 text-right">
          <div className="font-semibold text-sm sm:text-base truncate">{row.group_name}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {row.students_count} طالب • متوسط {fmtPct(row.avg_percentage)} • حضور {fmtPct(row.attendance_rate)}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
          {row.chronic_absent_count > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5">
              غياب {row.chronic_absent_count}
            </Badge>
          )}
          {row.top_count > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
              متفوق {row.top_count}
            </Badge>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t p-2 space-y-2 bg-background">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الكود…"
              className="pr-8 h-9 text-sm"
            />
          </div>

          {isFetching && !students && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل الطلاب…
            </div>
          )}

          {students && students.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">لا يوجد طلاب.</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {students?.map((s) => (
              <StudentRow key={s.id} s={s} onClick={() => onSelectStudent(s)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Student Row ─────────────────────────── */

function StudentRow({ s, onClick }: { s: TreeStudentRow; onClick: () => void }) {
  const missedLast = s.last_exam_id != null && !s.last_exam_attended;
  const rate = s.scheduled_count > 0 ? Math.round((s.attended_count / s.scheduled_count) * 100) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-right p-2.5 rounded-lg border-2 border-border/60 hover:border-primary/50 hover:shadow-sm transition-all bg-card flex items-center gap-2.5 group"
    >
      <Avatar className="h-9 w-9 shrink-0 ring-2 ring-primary/10">
        <AvatarImage src={s.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
          {s.full_name.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{s.full_name}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5" dir="ltr">
          <span className="font-mono">{s.code}</span>
          {rate !== null && (
            <><span>•</span><span>{rate}% حضور</span></>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {s.status === "suspended" && (
          <Badge variant="destructive" className="text-[9px] h-4 px-1.5">موقوف</Badge>
        )}
        {missedLast && (
          <Badge variant="destructive" className="text-[9px] h-4 px-1.5 gap-0.5">
            <AlertTriangle className="h-2.5 w-2.5" /> غاب
          </Badge>
        )}
        {s.absent_count >= 3 && !missedLast && (
          <Badge variant="destructive" className="text-[9px] h-4 px-1.5">غياب {s.absent_count}</Badge>
        )}
        {s.avg_percentage >= 80 && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
            {Math.round(Number(s.avg_percentage))}%
          </Badge>
        )}
      </div>
    </button>
  );
}

/* ─────────────────────────── Drawer ─────────────────────────── */

function StudentDrawer({
  student, onClose, onEdit,
}: {
  student: TreeStudentRow | null;
  onClose: () => void;
  onEdit: (s: TreeStudentRow) => void;
}) {
  const qc = useQueryClient();
  const s = student;

  const { data: history } = useQuery({
    queryKey: ["tree", "student-history", s?.id],
    enabled: !!s,
    queryFn: async () => {
      if (!s) return [];
      const { data } = await supabase
        .from("exam_attempts")
        .select("id, exam_id, percentage, submitted_at, exams(title, starts_at)")
        .eq("student_id", s.id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(10);
      return (data ?? []) as any[];
    },
  });

  const toggleStatus = async () => {
    if (!s) return;
    const next = s.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("students").update({ status: next }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(next === "active" ? "تم تفعيل الحساب" : "تم إيقاف الحساب");
    qc.invalidateQueries({ queryKey: ["tree", "students"] });
    onClose();
  };

  return (
    <Sheet open={!!s} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto" dir="rtl">
        {s && (
          <>
            <SheetHeader className="text-right">
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16 ring-4 ring-primary/20">
                  <AvatarImage src={s.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                    {s.full_name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-lg truncate">{s.full_name}</SheetTitle>
                  <SheetDescription className="text-xs font-mono" dir="ltr">{s.code}</SheetDescription>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {s.status === "active" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] h-5" variant="outline">
                        <UserCheck className="h-3 w-3 ml-1" /> نشط
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] h-5">
                        <UserX className="h-3 w-3 ml-1" /> موقوف
                      </Badge>
                    )}
                    {s.avg_percentage >= 80 && (
                      <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        <Sparkles className="h-3 w-3 ml-1" /> متفوق
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatBox icon={TrendingUp} label="المتوسط" value={`${Math.round(Number(s.avg_percentage))}%`} color="text-primary" />
                <StatBox icon={UserCheck} label="حضور" value={s.attended_count} color="text-emerald-500" />
                <StatBox icon={UserX} label="غياب" value={s.absent_count} color="text-red-500" />
              </div>

              {/* Contact */}
              <Card>
                <CardContent className="p-3 space-y-2 text-sm">
                  <InfoRow label="هاتف الطالب" value={s.phone ?? "—"} />
                  <InfoRow label="اسم ولي الأمر" value={s.parent_name ?? "—"} />
                  <InfoRow label="هاتف ولي الأمر" value={s.parent_phone ?? "—"} />
                </CardContent>
              </Card>

              {/* Last exam */}
              {s.last_exam_id && (
                <Card>
                  <CardContent className="p-3 text-sm space-y-1">
                    <div className="text-xs text-muted-foreground">آخر امتحان</div>
                    <div className="font-semibold truncate">{s.last_exam_title}</div>
                    <div className="flex items-center gap-2">
                      {s.last_exam_attended ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]" variant="outline">
                          حضر — {s.last_exam_percentage != null ? `${Math.round(Number(s.last_exam_percentage))}%` : "—"}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">غاب</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* History */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">آخر 10 امتحانات</div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {(history ?? []).length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">لا يوجد سجل بعد.</div>
                  )}
                  {(history ?? []).map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between text-xs p-2 rounded border bg-muted/20">
                      <div className="truncate flex-1 min-w-0">
                        <div className="font-medium truncate">{h.exams?.title ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground" dir="ltr">
                          {h.submitted_at ? new Date(h.submitted_at).toLocaleDateString("ar-EG") : "—"}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {h.percentage != null ? `${Math.round(Number(h.percentage))}%` : "—"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button asChild variant="default" className="gap-2">
                  <Link to="/admin/students/$id" params={{ id: s.id }}>
                    <ExternalLink className="h-4 w-4" /> فتح الملف الكامل
                  </Link>
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => onEdit(s)}>
                  <Edit className="h-4 w-4" /> تعديل
                </Button>
                <WhatsAppButton
                  phone={s.parent_whatsapp ?? s.parent_phone}
                  label="واتساب ولي الأمر"
                  variant="outline"
                  className="col-span-2"
                />
                <Button
                  variant={s.status === "active" ? "destructive" : "default"}
                  className="col-span-2 gap-2"
                  onClick={toggleStatus}
                >
                  {s.status === "active" ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                  {s.status === "active" ? "إيقاف الحساب" : "تفعيل الحساب"}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─────────────────────────── Small pieces ─────────────────────────── */

function Kpi({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4 flex items-center gap-3">
        <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${color} shrink-0`} />
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs text-muted-foreground">{label}</div>
          <div className="text-lg sm:text-2xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="p-2.5 rounded-lg border bg-muted/30 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium truncate max-w-[60%]" dir="ltr">{value}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-10 flex flex-col items-center text-center gap-2">
        <Icon className="h-10 w-10 text-muted-foreground/50" />
        <div className="font-semibold">{title}</div>
        {hint && <div className="text-xs text-muted-foreground max-w-md">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(Number(v))}%`;
}

function mapToStudentForm(s: TreeStudentRow): any {
  return {
    id: s.id,
    code: s.code,
    full_name: s.full_name,
    avatar_url: s.avatar_url,
    phone: s.phone,
    parent_name: s.parent_name,
    parent_phone: s.parent_phone,
    parent_whatsapp: s.parent_whatsapp,
    status: s.status,
    points: s.points,
    level: s.level,
  };
}
