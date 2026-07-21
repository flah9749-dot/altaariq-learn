import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Users, Plus, Search, Download, Upload, Trash2, Ban, CheckCircle2,
  MoreHorizontal, Edit, Eye, Printer, Archive,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { StudentFormDialog } from "@/components/students/StudentFormDialog";
import { ImportStudentsDialog } from "@/components/students/ImportStudentsDialog";
import { deleteStudents, toggleStudentStatus } from "@/lib/students.functions";
import { archiveStudents } from "@/lib/archive.functions";
import { formatArabicDate, formatArabicDateTime, type StudentRow } from "@/lib/students-utils";
import { useDebounce } from "@/hooks/use-debounce";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/students/")({
  head: () => ({ meta: [{ title: "الطلاب — لوحة المدرس" }] }),
  component: StudentsPage,
});

const PAGE_SIZE = 20;

function StudentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[] } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveYear, setArchiveYear] = useState<string>(String(new Date().getFullYear()));

  const delFn = useServerFn(deleteStudents);
  const toggleFn = useServerFn(toggleStudentStatus);
  const archiveFn = useServerFn(archiveStudents);

  const debouncedSearch = useDebounce(search, 350);

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });
  const { data: groups } = useQuery({
    queryKey: ["groups-list"],
    queryFn: async () => (await supabase.from("groups").select("id,name,class_id").order("name")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["students", debouncedSearch, classFilter, groupFilter, statusFilter, page],
    queryFn: async () => {
      let q = supabase
        .from("students")
        .select("*, classes(id,name), groups(id,name)", { count: "exact" })
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (classFilter) q = q.eq("class_id", classFilter);
      if (groupFilter) q = q.eq("group_id", groupFilter);
      if (statusFilter) q = q.eq("status", statusFilter);
      if (debouncedSearch.trim()) {
        const s = `%${debouncedSearch.trim()}%`;
        q = q.or(`full_name.ilike.${s},code.ilike.${s},phone.ilike.${s},parent_name.ilike.${s},parent_phone.ilike.${s}`);
      }
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as StudentRow[], count: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected((s) => {
      const n = new Set(s);
      if (allChecked) rows.forEach((r) => n.delete(r.id));
      else rows.forEach((r) => n.add(r.id));
      return n;
    });
  };
  const toggleOne = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const deleteMut = useMutation({
    mutationFn: async (ids: string[]) => delFn({ data: { ids } }),
    onSuccess: (r: any) => {
      toast.success(`تم حذف ${r.count} طالب`);
      qc.invalidateQueries({ queryKey: ["students"] });
      setSelected(new Set()); setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: "active" | "suspended" }) =>
      toggleFn({ data: { ids, status } }),
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      qc.invalidateQueries({ queryKey: ["students"] });
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل التحديث"),
  });

  const archiveMut = useMutation({
    mutationFn: async ({ ids, year }: { ids: string[]; year: string }) => archiveFn({ data: { ids, year } }),
    onSuccess: (r: any) => {
      toast.success(`تم أرشفة ${r.count} طالب`);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["archived-students"] });
      setSelected(new Set());
      setArchiveOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الأرشفة"),
  });

  const exportExcel = () => {
    const data = rows.map((r) => ({
      "الاسم": r.full_name, "الكود": r.code, "الصف": r.classes?.name ?? "",
      "المجموعة": r.groups?.name ?? "", "الهاتف": r.phone ?? "",
      "ولي الأمر": r.parent_name ?? "", "هاتف ولي الأمر": r.parent_phone ?? "",
      "واتساب": r.parent_whatsapp ?? "", "الحالة": r.status === "active" ? "نشط" : "موقوف",
      "النقاط": r.points, "المستوى": r.level, "تاريخ التسجيل": formatArabicDate(r.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
    XLSX.writeFile(wb, `students-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const printList = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> إدارة الطلاب
          </h1>
          <p className="text-sm text-muted-foreground mt-1">الإجمالي: {total} طالب</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 ml-1" />استيراد</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}><Download className="h-4 w-4 ml-1" />تصدير</Button>
          <Button variant="outline" size="sm" onClick={printList}><Printer className="h-4 w-4 ml-1" />طباعة</Button>
          <Button size="sm" onClick={() => { setEditStudent(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 ml-1" />إضافة طالب
          </Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">فلاتر البحث</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث بالاسم، الكود، الهاتف..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pr-9" />
          </div>
          <Select value={classFilter || "all"} onValueChange={(v) => { setClassFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="كل الصفوف" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الصفوف</SelectItem>
              {(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={groupFilter || "all"} onValueChange={(v) => { setGroupFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="كل المجموعات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المجموعات</SelectItem>
              {(groups ?? []).filter((g) => !classFilter || g.class_id === classFilter).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="كل الحالات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="suspended">موقوف</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-wrap items-center gap-2 print:hidden">
          <span className="text-sm font-medium">تم تحديد {selected.size} طالب</span>
          <div className="mr-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ ids: [...selected], status: "suspended" })}>
              <Ban className="h-4 w-4 ml-1" />إيقاف
            </Button>
            <Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ ids: [...selected], status: "active" })}>
              <CheckCircle2 className="h-4 w-4 ml-1" />تفعيل
            </Button>
            <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4 ml-1" />أرشفة
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete({ ids: [...selected] })}>
              <Trash2 className="h-4 w-4 ml-1" />حذف
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 print:hidden">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>الكود</TableHead>
                <TableHead>الصف / المجموعة</TableHead>
                <TableHead>ولي الأمر</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التسجيل</TableHead>
                <TableHead>آخر دخول</TableHead>
                <TableHead className="print:hidden">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-10" /></TableCell></TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">لا يوجد طلاب مطابقين</TableCell></TableRow>
              ) : rows.map((s) => (
                <TableRow key={s.id} data-state={selected.has(s.id) ? "selected" : undefined}>
                  <TableCell className="print:hidden"><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleOne(s.id)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={s.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{s.full_name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <Link to="/admin/students/$id" params={{ id: s.id }} className="font-medium hover:underline">{s.full_name}</Link>
                        <div className="text-xs text-muted-foreground">{s.phone ?? "—"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="font-mono">{s.code}</Badge></TableCell>
                  <TableCell>
                    <div className="text-sm">{s.classes?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.groups?.name ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{s.parent_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.parent_phone ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    {s.status === "active" ? (
                      <Badge className="bg-success text-success-foreground">نشط</Badge>
                    ) : (
                      <Badge variant="destructive">موقوف</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatArabicDate(s.created_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatArabicDateTime(s.last_seen)}</TableCell>
                  <TableCell className="print:hidden">
                    <div className="flex items-center gap-1">
                      {s.parent_whatsapp && (
                        <WhatsAppButton
                          phone={s.parent_whatsapp}
                          template="wa.tpl.student_card"
                          vars={{
                            name: s.full_name,
                            code: s.code,
                            grade: s.classes?.name ?? "—",
                            class: s.groups?.name ?? "—",
                          }}
                          size="icon"
                          variant="ghost"
                        />
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/admin/students/$id" params={{ id: s.id }}><Eye className="h-4 w-4 ml-2" />عرض الكارت</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditStudent(s); setFormOpen(true); }}>
                            <Edit className="h-4 w-4 ml-2" />تعديل
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleMut.mutate({ ids: [s.id], status: s.status === "active" ? "suspended" : "active" })}>
                            {s.status === "active" ? <><Ban className="h-4 w-4 ml-2" />إيقاف</> : <><CheckCircle2 className="h-4 w-4 ml-2" />تفعيل</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete({ ids: [s.id] })}>
                            <Trash2 className="h-4 w-4 ml-2" />حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between print:hidden">
          <div className="text-sm text-muted-foreground">صفحة {page + 1} من {totalPages}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>السابق</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
          </div>
        </div>
      )}

      <StudentFormDialog open={formOpen} onOpenChange={setFormOpen} student={editStudent} />
      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف {confirmDelete?.ids.length} طالب نهائيًا مع كل بياناتهم. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.ids)}>
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />أرشفة {selected.size} طالب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              سيحتفظ الطلاب المؤرشفون بكل بياناتهم (النتائج، الرسائل، النقاط، الجوائز). يمكن استرجاعهم لاحقًا من صفحة الأرشيف.
            </p>
            <div className="space-y-1.5">
              <Label>السنة الدراسية</Label>
              <Input value={archiveYear} onChange={(e) => setArchiveYear(e.target.value)} placeholder="2024-2025" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => archiveMut.mutate({ ids: [...selected], year: archiveYear.trim() || String(new Date().getFullYear()) })}
              disabled={archiveMut.isPending}
            >
              <Archive className="h-4 w-4 ml-1" />تأكيد الأرشفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
