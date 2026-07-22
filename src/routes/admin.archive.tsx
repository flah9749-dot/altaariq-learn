import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
// xlsx is dynamically imported inside exportExcel() to keep it out of the initial bundle
import {
  Archive, Search, Download, RotateCcw, ArrowUp, Eye, Upload,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import { restoreStudents, promoteStudents, bulkArchiveByCodes } from "@/lib/archive.functions";
import { formatArabicDate, type StudentRow } from "@/lib/students-utils";

export const Route = createFileRoute("/admin/archive")({
  head: () => ({ meta: [{ title: "أرشيف الطلاب — لوحة المدرس" }] }),
  component: ArchivePage,
});

function ArchivePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importYear, setImportYear] = useState<string>(String(new Date().getFullYear()));
  const [importCodes, setImportCodes] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState<string>("");
  const debounced = useDebounce(search, 350);

  const restoreFn = useServerFn(restoreStudents);
  const promoteFn = useServerFn(promoteStudents);
  const bulkArchiveFn = useServerFn(bulkArchiveByCodes);


  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["archived-students", debounced, yearFilter, classFilter],
    queryFn: async () => {
      let q = supabase
        .from("students")
        .select("*, classes(id,name), groups(id,name)")
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });
      if (yearFilter) q = q.eq("archived_year", yearFilter);
      if (classFilter) q = q.eq("class_id", classFilter);
      if (debounced.trim()) {
        const s = `%${debounced.trim()}%`;
        q = q.or(`full_name.ilike.${s},code.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as StudentRow[];
    },
  });

  const rows = data ?? [];
  const years = useMemo(() => Array.from(new Set(rows.map((r) => r.archived_year).filter(Boolean))) as string[], [rows]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected((s) => {
      const n = new Set(s);
      if (allChecked) rows.forEach((r) => n.delete(r.id));
      else rows.forEach((r) => n.add(r.id));
      return n;
    });
  };

  const restoreMut = useMutation({
    mutationFn: async (ids: string[]) => restoreFn({ data: { ids } }),
    onSuccess: (r: any) => {
      toast.success(`تم استرجاع ${r.count} طالب`);
      qc.invalidateQueries({ queryKey: ["archived-students"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الاسترجاع"),
  });

  const promoteMut = useMutation({
    mutationFn: async (ids: string[]) => promoteFn({ data: { ids } }),
    onSuccess: (r: any) => {
      toast.success(`تم نقل ${r.count} طالب للعام الجديد`);
      qc.invalidateQueries({ queryKey: ["archived-students"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل النقل"),
  });

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const data = rows.map((r) => ({
      "الاسم": r.full_name, "الكود": r.code,
      "الصف": r.classes?.name ?? "", "المجموعة": r.groups?.name ?? "",
      "سنة الأرشفة": r.archived_year ?? "",
      "تاريخ الأرشفة": formatArabicDate(r.archived_at ?? null),
      "النقاط": r.points, "المستوى": r.level,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأرشيف");
    XLSX.writeFile(wb, `archive-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary" /> أرشيف الطلاب
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} طالب مؤرشف · تحتفظ المنصة بكل البيانات (النتائج، الرسائل، النقاط، الجوائز) ويمكن استرجاعهم في أي وقت.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <Download className="h-4 w-4 ml-1" />تصدير Excel
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">بحث وفلترة</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ابحث بالاسم أو الكود..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
          </div>
          <Select value={yearFilter || "all"} onValueChange={(v) => setYearFilter(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="كل السنوات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل السنوات</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classFilter || "all"} onValueChange={(v) => setClassFilter(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="كل الصفوف" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الصفوف</SelectItem>
              {(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">تم تحديد {selected.size} طالب</span>
          <div className="mr-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => restoreMut.mutate([...selected])} disabled={restoreMut.isPending}>
              <RotateCcw className="h-4 w-4 ml-1" />استرجاع
            </Button>
            <Button size="sm" onClick={() => promoteMut.mutate([...selected])} disabled={promoteMut.isPending}>
              <ArrowUp className="h-4 w-4 ml-1" />نقل لسنة جديدة
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>الكود</TableHead>
                <TableHead>الصف / المجموعة</TableHead>
                <TableHead>سنة الأرشفة</TableHead>
                <TableHead>تاريخ الأرشفة</TableHead>
                <TableHead>النقاط</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10" /></TableCell></TableRow>
              )) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">لا يوجد طلاب في الأرشيف</TableCell></TableRow>
              ) : rows.map((s) => (
                <TableRow key={s.id} data-state={selected.has(s.id) ? "selected" : undefined}>
                  <TableCell><Checkbox checked={selected.has(s.id)} onCheckedChange={() => setSelected((x) => { const n = new Set(x); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={s.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{s.full_name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <Link to="/admin/students/$id" params={{ id: s.id }} className="font-medium hover:underline">{s.full_name}</Link>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="font-mono">{s.code}</Badge></TableCell>
                  <TableCell className="text-sm">
                    <div>{s.classes?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.groups?.name ?? "—"}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{s.archived_year ?? "—"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatArabicDate(s.archived_at ?? null)}</TableCell>
                  <TableCell><Badge variant="outline">{s.points}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button asChild size="icon" variant="ghost" title="عرض" aria-label="عرض بيانات الطالب">
                        <Link to="/admin/students/$id" params={{ id: s.id }}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      <Button size="icon" variant="ghost" title="استرجاع" aria-label="استرجاع الطالب" onClick={() => restoreMut.mutate([s.id])}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
