import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/competitions")({
  head: () => ({ meta: [{ title: "المسابقات — لوحة المدرس" }] }),
  component: CompetitionsPage,
});

function CompetitionsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: async () => (await supabase.from("competitions").select("*").order("starts_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", description: "", type: "weekly",
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    winners_count: 3, prize: "", bonus_points: 50, active: true,
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", type: "weekly", starts_at: new Date().toISOString().slice(0,16), ends_at: new Date(Date.now()+7*86400000).toISOString().slice(0,16), winners_count: 3, prize: "", bonus_points: 50, active: true });
    setOpen(true);
  };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? "", type: c.type, starts_at: c.starts_at.slice(0,16), ends_at: c.ends_at.slice(0,16), winners_count: c.winners_count, prize: c.prize ?? "", bonus_points: c.bonus_points, active: c.active });
    setOpen(true);
  };
  const save = async () => {
    if (!form.name.trim()) return toast.error("الاسم مطلوب");
    const payload = { ...form, starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString() };
    const { error } = editing
      ? await supabase.from("competitions").update(payload).eq("id", editing.id)
      : await supabase.from("competitions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["competitions"] });
  };
  const remove = async (id: string) => {
    if (!confirm("حذف المسابقة؟")) return;
    await supabase.from("competitions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["competitions"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Trophy className="h-7 w-7 text-gold"/>المسابقات</h1>
          <p className="text-sm text-muted-foreground mt-1">مسابقات يومية / أسبوعية / شهرية بجوائز ونقاط إضافية.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 ml-1"/>مسابقة جديدة</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{editing ? "تعديل مسابقة" : "مسابقة جديدة"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
              <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>النوع</Label>
                  <select className="w-full border rounded-md h-9 px-2 bg-background" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}>
                    <option value="daily">يومية</option><option value="weekly">أسبوعية</option>
                    <option value="monthly">شهرية</option><option value="custom">مخصصة</option>
                  </select>
                </div>
                <div><Label>عدد الفائزين</Label><Input type="number" value={form.winners_count} onChange={(e)=>setForm({...form,winners_count:+e.target.value})}/></div>
                <div><Label>البداية</Label><Input type="datetime-local" value={form.starts_at} onChange={(e)=>setForm({...form,starts_at:e.target.value})}/></div>
                <div><Label>النهاية</Label><Input type="datetime-local" value={form.ends_at} onChange={(e)=>setForm({...form,ends_at:e.target.value})}/></div>
              </div>
              <div><Label>الجائزة</Label><Input value={form.prize} onChange={(e)=>setForm({...form,prize:e.target.value})}/></div>
              <div><Label>نقاط إضافية للفائز</Label><Input type="number" value={form.bonus_points} onChange={(e)=>setForm({...form,bonus_points:+e.target.value})}/></div>
              <div className="flex items-center justify-between"><Label>مفعّلة</Label><Switch checked={form.active} onCheckedChange={(v)=>setForm({...form,active:v})}/></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-40"/> : (data ?? []).length === 0 ? (
        <Card><CardContent className="text-center py-16 text-muted-foreground">لا توجد مسابقات — أنشئ أول مسابقة.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((c: any) => {
            const now = Date.now();
            const start = new Date(c.starts_at).getTime();
            const end = new Date(c.ends_at).getTime();
            const status = !c.active ? "موقوفة" : now < start ? "قادمة" : now > end ? "منتهية" : "جارية";
            return (
              <Card key={c.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <Badge variant={status==="جارية"?"default":status==="قادمة"?"outline":"secondary"}>{status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {c.description && <p className="text-muted-foreground text-xs line-clamp-2">{c.description}</p>}
                  <div className="flex items-center gap-2 text-xs"><Calendar className="h-3 w-3"/>{new Date(c.starts_at).toLocaleDateString("ar-EG")} → {new Date(c.ends_at).toLocaleDateString("ar-EG")}</div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">{c.type}</Badge>
                    <Badge className="bg-gold text-gold-foreground">🏆 {c.prize || "—"}</Badge>
                    <Badge>⭐ +{c.bonus_points}</Badge>
                  </div>
                  <div className="flex gap-1 pt-2">
                    <Button size="sm" variant="outline" onClick={()=>openEdit(c)}><Pencil className="h-3 w-3 ml-1"/>تعديل</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={()=>remove(c.id)}><Trash2 className="h-3 w-3"/></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
