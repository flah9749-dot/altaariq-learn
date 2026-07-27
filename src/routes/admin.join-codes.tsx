import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Copy, Pencil, Trash2, Ticket, Users, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { listJoinCodes, createJoinCode, updateJoinCode, deleteJoinCode } from "@/lib/self-registration.functions";

export const Route = createFileRoute("/admin/join-codes")({
  head: () => ({ meta: [{ title: "أكواد الانضمام — لوحة المدرس" }] }),
  component: JoinCodesPage,
});

function JoinCodesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listJoinCodes);
  const delFn = useServerFn(deleteJoinCode);
  const updFn = useServerFn(updateJoinCode);

  const { data: rows, isLoading } = useQuery({ queryKey: ["join-codes"], queryFn: () => listFn({}) });
  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [] });
  const { data: groups } = useQuery({ queryKey: ["groups"], queryFn: async () => (await supabase.from("groups").select("id,name,class_id").order("name")).data ?? [] });

  const toggleActive = useMutation({
    mutationFn: async (row: any) => updFn({ data: { id: row.id, patch: { active: !row.active } } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["join-codes"] }); toast.success("تم التحديث"); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التحديث"),
  });
  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["join-codes"] }); toast.success("تم الحذف"); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("تم نسخ الكود"); };
  const shareLink = (code: string) => `${window.location.origin}/register?code=${encodeURIComponent(code)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Ticket className="h-7 w-7 text-primary" /> أكواد الانضمام
          </h1>
          <p className="text-sm text-muted-foreground mt-1">أنشئ أكواداً تُتيح للطلاب التسجيل الذاتي والانضمام إلى صفوفهم ومجموعاتهم.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> كود جديد</Button></DialogTrigger>
          <CodeFormDialog onClose={() => setCreateOpen(false)} classes={classes ?? []} groups={groups ?? []} />
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">الأكواد ({(rows ?? []).length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الصف</TableHead>
                <TableHead>المجموعة</TableHead>
                <TableHead>الاستخدام</TableHead>
                <TableHead>الانتهاء</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8" /></TableCell></TableRow>
              )) : (rows ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد أكواد بعد. أنشئ أول كود.</TableCell></TableRow>
              ) : (rows as any[]).map((r) => (
                <TableRow key={r.id}>
                  <TableCell><code className="font-mono font-bold" dir="ltr">{r.code}</code></TableCell>
                  <TableCell>{r.classes?.name ?? "—"}</TableCell>
                  <TableCell>{r.groups?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm"><Users className="inline h-3.5 w-3.5 mr-1" /> {r.used_count}{r.max_uses ? ` / ${r.max_uses}` : ""}</TableCell>
                  <TableCell className="text-xs">{r.expires_at ? new Date(r.expires_at).toLocaleDateString("ar-EG") : "—"}</TableCell>
                  <TableCell>
                    <Switch checked={r.active} onCheckedChange={() => toggleActive.mutate(r)} />
                    {!r.active && <Badge variant="outline" className="ml-2">معطّل</Badge>}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button size="icon" variant="ghost" title="نسخ الكود" onClick={() => copy(r.code)}><Copy className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="نسخ رابط التسجيل" onClick={() => { navigator.clipboard.writeText(shareLink(r.code)); toast.success("تم نسخ الرابط"); }}>🔗</Button>
                      <Button size="icon" variant="ghost" title="تعديل" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost" title="حذف" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف الكود</AlertDialogTitle>
                            <AlertDialogDescription>سيتم حذف الكود نهائياً. لن يؤثر ذلك على الطلاب المسجّلين بالفعل.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => delMut.mutate(r.id)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <CodeFormDialog onClose={() => setEditing(null)} classes={classes ?? []} groups={groups ?? []} initial={editing} />
        </Dialog>
      )}
    </div>
  );
}

function CodeFormDialog({ onClose, classes, groups, initial }: { onClose: () => void; classes: any[]; groups: any[]; initial?: any }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createJoinCode);
  const updFn = useServerFn(updateJoinCode);
  const [code, setCode] = useState<string>(initial?.code ?? "");
  const [classId, setClassId] = useState<string>(initial?.class_id ?? "");
  const [groupId, setGroupId] = useState<string>(initial?.group_id ?? "");
  const [maxUses, setMaxUses] = useState<string>(initial?.max_uses?.toString() ?? "");
  const [expiresAt, setExpiresAt] = useState<string>(initial?.expires_at ? new Date(initial.expires_at).toISOString().slice(0, 10) : "");
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const filteredGroups = (groups ?? []).filter((g: any) => !classId || g.class_id === classId);

  const suggest = () => {
    const cls = classes.find((c: any) => c.id === classId)?.name ?? "G";
    const grp = groups.find((g: any) => g.id === groupId)?.name ?? "A";
    const year = new Date().getFullYear();
    const clean = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "X";
    setCode(`${clean(cls)}-${clean(grp)}-${year}`);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !classId || !groupId) { toast.error("أكمل البيانات المطلوبة"); return; }
    setSaving(true);
    try {
      const payload: any = {
        code: code.trim(),
        class_id: classId,
        group_id: groupId,
        max_uses: maxUses ? parseInt(maxUses, 10) : null,
        expires_at: expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null,
        notes: notes.trim() || null,
      };
      if (initial) await updFn({ data: { id: initial.id, patch: payload } });
      else await createFn({ data: payload });
      qc.invalidateQueries({ queryKey: ["join-codes"] });
      toast.success("تم الحفظ");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally { setSaving(false); }
  };

  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>{initial ? "تعديل كود انضمام" : "إنشاء كود انضمام جديد"}</DialogTitle></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الصف *</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setGroupId(""); }}>
              <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المجموعة *</Label>
            <Select value={groupId} onValueChange={setGroupId} disabled={!classId}>
              <SelectTrigger><SelectValue placeholder="اختر المجموعة" /></SelectTrigger>
              <SelectContent>{filteredGroups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>الكود *</Label>
            <Button type="button" variant="ghost" size="sm" onClick={suggest}>اقتراح</Button>
          </div>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} dir="ltr" className="font-mono" placeholder="G1-A-2026" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الحد الأقصى للاستخدام</Label>
            <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="بدون حد" />
          </div>
          <div className="space-y-2">
            <Label>تاريخ الانتهاء</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>ملاحظات</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
