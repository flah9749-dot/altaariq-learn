import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Plus, Trash2, Users, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/classes")({
  head: () => ({ meta: [{ title: "الصفوف الدراسية — لوحة المدرس" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  const qc = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classDialog, setClassDialog] = useState<{ open: boolean; id?: string; name: string }>({ open: false, name: "" });
  const [groupDialog, setGroupDialog] = useState<{ open: boolean; id?: string; name: string; class_id: string }>({ open: false, name: "", class_id: "" });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-manage"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups-manage"],
    queryFn: async () => (await supabase.from("groups").select("id,name,class_id").order("name")).data ?? [],
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["classes-student-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("class_id,group_id");
      const map: Record<string, { cls: number; groups: Record<string, number> }> = {};
      (data ?? []).forEach((s: any) => {
        if (s.class_id) {
          map[s.class_id] ??= { cls: 0, groups: {} };
          map[s.class_id].cls++;
          if (s.group_id) map[s.class_id].groups[s.group_id] = (map[s.class_id].groups[s.group_id] ?? 0) + 1;
        }
      });
      return map;
    },
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["classes-manage"] });
    qc.invalidateQueries({ queryKey: ["groups-manage"] });
    qc.invalidateQueries({ queryKey: ["classes-student-counts"] });
  };

  async function saveClass() {
    const name = classDialog.name.trim();
    if (!name) return toast.error("أدخل اسم الصف");
    const res = classDialog.id
      ? await supabase.from("classes").update({ name }).eq("id", classDialog.id)
      : await supabase.from("classes").insert({ name });
    if (res.error) return toast.error(res.error.message);
    toast.success("تم الحفظ");
    setClassDialog({ open: false, name: "" });
    refetch();
  }

  async function deleteClass(id: string) {
    if (!confirm("حذف الصف؟ سيتم حذف مجموعاته أيضاً.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    if (selectedClassId === id) setSelectedClassId(null);
    refetch();
  }

  async function saveGroup() {
    const name = groupDialog.name.trim();
    if (!name || !groupDialog.class_id) return toast.error("أدخل اسم المجموعة");
    const res = groupDialog.id
      ? await supabase.from("groups").update({ name, class_id: groupDialog.class_id }).eq("id", groupDialog.id)
      : await supabase.from("groups").insert({ name, class_id: groupDialog.class_id });
    if (res.error) return toast.error(res.error.message);
    toast.success("تم الحفظ");
    setGroupDialog({ open: false, name: "", class_id: "" });
    refetch();
  }

  async function deleteGroup(id: string) {
    if (!confirm("حذف المجموعة؟")) return;
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    refetch();
  }

  const activeClass = classes.find((c) => c.id === selectedClassId) ?? classes[0];
  const activeId = activeClass?.id;
  const classGroups = groups.filter((g) => g.class_id === activeId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="h-6 w-6" /> الصفوف الدراسية</h1>
          <p className="text-sm text-muted-foreground">أضف الصفوف الدراسية وأنشئ منها المجموعات</p>
        </div>
        <Button onClick={() => setClassDialog({ open: true, name: "" })}>
          <Plus className="h-4 w-4 ml-1" /> إضافة صف دراسي
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 space-y-2 md:col-span-1">
          <h2 className="font-semibold mb-2">الصفوف ({classes.length})</h2>
          {classes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">لا توجد صفوف بعد</p>}
          {classes.map((c) => {
            const ct = counts[c.id];
            const isActive = c.id === activeId;
            return (
              <div key={c.id} className={`flex items-center justify-between gap-2 rounded-lg border p-3 cursor-pointer transition ${isActive ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                onClick={() => setSelectedClassId(c.id)}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{ct?.cls ?? 0} طالب</div>
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setClassDialog({ open: true, id: c.id, name: c.name }); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteClass(c.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </Card>

        <Card className="p-4 space-y-2 md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> مجموعات {activeClass?.name ?? "—"}</h2>
            {activeId && (
              <Button size="sm" onClick={() => setGroupDialog({ open: true, name: "", class_id: activeId })}>
                <Plus className="h-4 w-4 ml-1" /> إضافة مجموعة
              </Button>
            )}
          </div>
          {!activeId && <p className="text-sm text-muted-foreground text-center py-8">اختر صفاً لعرض مجموعاته</p>}
          {activeId && classGroups.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">لا توجد مجموعات — أنشئ أول مجموعة</p>}
          {classGroups.map((g) => {
            const cnt = counts[activeId!]?.groups?.[g.id] ?? 0;
            return (
              <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="font-medium truncate">{g.name}</div>
                  <Badge variant="secondary">{cnt} طالب</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setGroupDialog({ open: true, id: g.id, name: g.name, class_id: g.class_id ?? activeId! })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteGroup(g.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </Card>
      </div>

      <Dialog open={classDialog.open} onOpenChange={(o) => setClassDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>{classDialog.id ? "تعديل صف" : "إضافة صف دراسي"}</DialogTitle></DialogHeader>
          <Input placeholder="اسم الصف (مثال: الصف الأول الثانوي)" value={classDialog.name}
            onChange={(e) => setClassDialog((s) => ({ ...s, name: e.target.value }))} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassDialog({ open: false, name: "" })}>إلغاء</Button>
            <Button onClick={saveClass}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={groupDialog.open} onOpenChange={(o) => setGroupDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>{groupDialog.id ? "تعديل مجموعة" : "إضافة مجموعة"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm mb-1 block">الصف الدراسي</label>
              <Select value={groupDialog.class_id} onValueChange={(v) => setGroupDialog((s) => ({ ...s, class_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm mb-1 block">اسم المجموعة</label>
              <Input placeholder="مثال: مجموعة السبت 3 عصراً" value={groupDialog.name}
                onChange={(e) => setGroupDialog((s) => ({ ...s, name: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog({ open: false, name: "", class_id: "" })}>إلغاء</Button>
            <Button onClick={saveGroup}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
