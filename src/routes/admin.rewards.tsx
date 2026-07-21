import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Plus, Pencil, Trash2, Package, ShoppingBag, Trophy, Medal, TrendingUp, Settings2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { whatsappUrl } from "@/lib/whatsapp";
import { useDefaultCountryCode } from "@/hooks/use-default-country-code";
import { whatsappCongrats } from "@/lib/gamification";
import { SectionTabs } from "@/components/admin/SectionTabs";

export const Route = createFileRoute("/admin/rewards")({
  head: () => ({ meta: [{ title: "الجوائز والنقاط — لوحة المدرس" }] }),
  component: RewardsAdminPage,
});

function RewardsAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Award className="h-7 w-7 text-gold" />الجوائز والتحفيز
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          إدارة متجر الجوائز والشارات والإنجازات والمستويات وقواعد النقاط.
        </p>
      </div>
      <SectionTabs items={[{ to: "/admin/rewards", label: "الجوائز والنقاط" }, { to: "/admin/competitions", label: "المسابقات" }]} />

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList className="grid grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="catalog"><ShoppingBag className="h-4 w-4 ml-1"/>المتجر</TabsTrigger>
          <TabsTrigger value="redemptions"><Package className="h-4 w-4 ml-1"/>الطلبات</TabsTrigger>
          <TabsTrigger value="badges"><Medal className="h-4 w-4 ml-1"/>الشارات</TabsTrigger>
          <TabsTrigger value="achievements"><Trophy className="h-4 w-4 ml-1"/>الإنجازات</TabsTrigger>
          <TabsTrigger value="levels"><TrendingUp className="h-4 w-4 ml-1"/>المستويات</TabsTrigger>
          <TabsTrigger value="rules"><Settings2 className="h-4 w-4 ml-1"/>قواعد النقاط</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog"><CatalogTab/></TabsContent>
        <TabsContent value="redemptions"><RedemptionsTab/></TabsContent>
        <TabsContent value="badges"><BadgesTab/></TabsContent>
        <TabsContent value="achievements"><AchievementsTab/></TabsContent>
        <TabsContent value="levels"><LevelsTab/></TabsContent>
        <TabsContent value="rules"><RulesTab/></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------- Catalog ---------------------------- */
function CatalogTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["reward_catalog"],
    queryFn: async () => (await supabase.from("reward_catalog").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", image_url: "", points_cost: 100, stock: "", active: true });

  const openNew = () => { setEditing(null); setForm({ title: "", description: "", image_url: "", points_cost: 100, stock: "", active: true }); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ title: r.title, description: r.description ?? "", image_url: r.image_url ?? "", points_cost: r.points_cost, stock: r.stock?.toString() ?? "", active: r.active }); setOpen(true); };

  const save = async () => {
    if (!form.title.trim()) return toast.error("العنوان مطلوب");
    const payload = {
      title: form.title.trim(), description: form.description.trim() || null, image_url: form.image_url.trim() || null,
      points_cost: Number(form.points_cost) || 0, stock: form.stock ? Number(form.stock) : null, active: form.active,
    };
    const { error } = editing
      ? await supabase.from("reward_catalog").update(payload).eq("id", editing.id)
      : await supabase.from("reward_catalog").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "تم التحديث" : "تمت الإضافة");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["reward_catalog"] });
  };
  const remove = async (id: string) => {
    if (!confirm("حذف الجائزة؟")) return;
    const { error } = await supabase.from("reward_catalog").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reward_catalog"] });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>متجر الجوائز</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 ml-1"/>إضافة جائزة</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "تعديل جائزة" : "جائزة جديدة"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>العنوان</Label><Input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></div>
              <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div>
              <div><Label>رابط الصورة</Label><Input value={form.image_url} onChange={(e)=>setForm({...form,image_url:e.target.value})} placeholder="https://..."/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>تكلفة النقاط</Label><Input type="number" value={form.points_cost} onChange={(e)=>setForm({...form,points_cost:+e.target.value})}/></div>
                <div><Label>الكمية (اتركه فارغًا لغير محدود)</Label><Input type="number" value={form.stock} onChange={(e)=>setForm({...form,stock:e.target.value})}/></div>
              </div>
              <div className="flex items-center justify-between"><Label>مفعّل</Label><Switch checked={form.active} onCheckedChange={(v)=>setForm({...form,active:v})}/></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40"/> : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">لا توجد جوائز — أضف أول جائزة.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data!.map((r: any) => (
              <Card key={r.id} className="overflow-hidden">
                {r.image_url && <img src={r.image_url} alt={r.title} className="h-32 w-full object-cover"/>}
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold">{r.title}</p>
                    {!r.active && <Badge variant="outline">موقوف</Badge>}
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className="bg-gold text-gold-foreground">⭐ {r.points_cost}</Badge>
                    {r.stock !== null && <Badge variant="outline">الكمية: {r.stock}</Badge>}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={()=>openEdit(r)}><Pencil className="h-3 w-3 ml-1"/>تعديل</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={()=>remove(r.id)}><Trash2 className="h-3 w-3"/></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------- Redemptions -------------------------- */
function RedemptionsTab() {
  const qc = useQueryClient();
  const countryCode = useDefaultCountryCode();
  const { data, isLoading } = useQuery({
    queryKey: ["redemptions"],
    queryFn: async () => (await supabase.from("reward_redemptions")
      .select("*, reward_catalog(title,image_url), students(id,full_name,code,points,level,parent_whatsapp,parent_phone)")
      .order("created_at", { ascending: false })).data ?? [],
  });
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("reward_redemptions").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم التحديث");
    qc.invalidateQueries({ queryKey: ["redemptions"] });
  };

  return (
    <Card>
      <CardHeader><CardTitle>طلبات الاستبدال</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {isLoading ? <Skeleton className="h-40 m-4"/> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>الطالب</TableHead><TableHead>الجائزة</TableHead>
              <TableHead>النقاط</TableHead><TableHead>الحالة</TableHead>
              <TableHead>التاريخ</TableHead><TableHead>إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد طلبات</TableCell></TableRow>}
              {(data ?? []).map((r: any) => {
                const parent = r.students?.parent_whatsapp ?? r.students?.parent_phone;
                const msg = whatsappCongrats(r.students?.full_name ?? "", r.reward_catalog?.title ?? "", r.students?.points ?? 0, r.students?.level ?? 1);
                const waLink = whatsappUrl(parent, msg, countryCode);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.students?.full_name}<div className="text-xs text-muted-foreground">{r.students?.code}</div></TableCell>
                    <TableCell>{r.reward_catalog?.title}</TableCell>
                    <TableCell><Badge>⭐ {r.points_spent}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={r.status === "delivered" ? "default" : r.status === "cancelled" ? "destructive" : "outline"}>
                        {r.status === "pending" ? "قيد الانتظار" : r.status === "delivered" ? "تم التسليم" : "ملغى"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-EG")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.status !== "delivered" && <Button size="sm" variant="outline" onClick={()=>setStatus(r.id,"delivered")}><Check className="h-3 w-3 ml-1"/>تسليم</Button>}
                        {r.status !== "cancelled" && <Button size="sm" variant="ghost" className="text-destructive" onClick={()=>setStatus(r.id,"cancelled")}><X className="h-3 w-3"/></Button>}
                        {waLink && <Button size="sm" variant="outline" asChild><a href={waLink} target="_blank" rel="noreferrer">واتساب</a></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Badges ---------------------------- */
function BadgesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["badges"], queryFn: async () => (await supabase.from("badges").select("*").order("created_at")).data ?? [] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", icon: "award", color: "#f59e0b", condition_type: "manual", condition_value: 0, active: true });
  const openNew = ()=>{ setEditing(null); setForm({ name: "", description: "", icon: "award", color: "#f59e0b", condition_type: "manual", condition_value: 0, active: true }); setOpen(true); };
  const openEdit = (b: any)=>{ setEditing(b); setForm({ name: b.name, description: b.description ?? "", icon: b.icon ?? "award", color: b.color ?? "#f59e0b", condition_type: b.condition_type ?? "manual", condition_value: b.condition_value ?? 0, active: b.active }); setOpen(true); };
  const save = async () => {
    if (!form.name.trim()) return toast.error("الاسم مطلوب");
    const { error } = editing
      ? await supabase.from("badges").update(form).eq("id", editing.id)
      : await supabase.from("badges").insert(form);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["badges"] });
  };
  const remove = async (id: string) => { if (!confirm("حذف الشارة؟")) return; await supabase.from("badges").delete().eq("id",id); qc.invalidateQueries({ queryKey: ["badges"] }); };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>الشارات</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 ml-1"/>شارة جديدة</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل شارة" : "شارة جديدة"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
              <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الأيقونة (اسم Lucide)</Label><Input value={form.icon} onChange={(e)=>setForm({...form,icon:e.target.value})}/></div>
                <div><Label>اللون</Label><Input type="color" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})}/></div>
              </div>
              <div className="flex items-center justify-between"><Label>مفعّلة</Label><Switch checked={form.active} onCheckedChange={(v)=>setForm({...form,active:v})}/></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((b: any) => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: b.color }}>
                  <Medal className="h-6 w-6"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.description}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={()=>openEdit(b)}><Pencil className="h-3 w-3"/></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={()=>remove(b.id)}><Trash2 className="h-3 w-3"/></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-10">لا توجد شارات بعد.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------- Achievements ------------------------- */
function AchievementsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["achievements"], queryFn: async () => (await supabase.from("achievements").select("*").order("created_at")).data ?? [] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ key: "", name: "", description: "", condition_type: "exam_count", condition_value: 1, points_reward: 10, active: true });
  const openNew = ()=>{ setEditing(null); setForm({ key: "", name: "", description: "", condition_type: "exam_count", condition_value: 1, points_reward: 10, active: true }); setOpen(true); };
  const openEdit = (a: any)=>{ setEditing(a); setForm({ key: a.key, name: a.name, description: a.description ?? "", condition_type: a.condition_type ?? "exam_count", condition_value: a.condition_value ?? 1, points_reward: a.points_reward ?? 0, active: a.active }); setOpen(true); };
  const save = async () => {
    if (!form.key.trim() || !form.name.trim()) return toast.error("المفتاح والاسم مطلوبان");
    const { error } = editing
      ? await supabase.from("achievements").update(form).eq("id", editing.id)
      : await supabase.from("achievements").insert(form);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["achievements"] });
  };
  const remove = async (id: string) => { if (!confirm("حذف الإنجاز؟")) return; await supabase.from("achievements").delete().eq("id",id); qc.invalidateQueries({ queryKey: ["achievements"] }); };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>الإنجازات</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 ml-1"/>إنجاز جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل إنجاز" : "إنجاز جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>المفتاح (فريد بالإنجليزية)</Label><Input value={form.key} onChange={(e)=>setForm({...form,key:e.target.value})} disabled={!!editing}/></div>
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
              <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>نوع الشرط</Label>
                  <select className="w-full border rounded-md h-9 px-2 bg-background" value={form.condition_type} onChange={(e)=>setForm({...form,condition_type:e.target.value})}>
                    <option value="exam_count">عدد الامتحانات</option>
                    <option value="points">النقاط الإجمالية</option>
                    <option value="login_count">عدد مرات الدخول</option>
                  </select>
                </div>
                <div><Label>القيمة</Label><Input type="number" value={form.condition_value} onChange={(e)=>setForm({...form,condition_value:+e.target.value})}/></div>
              </div>
              <div><Label>مكافأة النقاط عند التحقق</Label><Input type="number" value={form.points_reward} onChange={(e)=>setForm({...form,points_reward:+e.target.value})}/></div>
              <div className="flex items-center justify-between"><Label>مفعّل</Label><Switch checked={form.active} onCheckedChange={(v)=>setForm({...form,active:v})}/></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الشرط</TableHead><TableHead>المكافأة</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{a.description}</div></TableCell>
                <TableCell className="text-xs">{a.condition_type} ≥ {a.condition_value}</TableCell>
                <TableCell>⭐ {a.points_reward}</TableCell>
                <TableCell>{a.active ? <Badge>مفعّل</Badge> : <Badge variant="outline">موقوف</Badge>}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={()=>openEdit(a)}><Pencil className="h-3 w-3"/></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={()=>remove(a.id)}><Trash2 className="h-3 w-3"/></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Levels ---------------------------- */
function LevelsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["levels"], queryFn: async () => (await supabase.from("levels").select("*").order("order_index")).data ?? [] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ order_index: 1, name: "", min_points: 0, color: "#1e293b", active: true });
  const openNew = ()=>{ setEditing(null); setForm({ order_index: (data?.length ?? 0) + 1, name: "", min_points: 0, color: "#1e293b", active: true }); setOpen(true); };
  const openEdit = (l: any)=>{ setEditing(l); setForm({ order_index: l.order_index, name: l.name, min_points: l.min_points, color: l.color ?? "#1e293b", active: l.active }); setOpen(true); };
  const save = async () => {
    if (!form.name.trim()) return toast.error("الاسم مطلوب");
    const { error } = editing
      ? await supabase.from("levels").update(form).eq("id", editing.id)
      : await supabase.from("levels").insert(form);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["levels"] });
  };
  const remove = async (id: string) => { if (!confirm("حذف المستوى؟")) return; await supabase.from("levels").delete().eq("id",id); qc.invalidateQueries({ queryKey: ["levels"] }); };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>المستويات</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 ml-1"/>مستوى جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل مستوى" : "مستوى جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الترتيب</Label><Input type="number" value={form.order_index} onChange={(e)=>setForm({...form,order_index:+e.target.value})}/></div>
                <div><Label>الحد الأدنى للنقاط</Label><Input type="number" value={form.min_points} onChange={(e)=>setForm({...form,min_points:+e.target.value})}/></div>
              </div>
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
              <div><Label>اللون</Label><Input type="color" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})}/></div>
              <div className="flex items-center justify-between"><Label>مفعّل</Label><Switch checked={form.active} onCheckedChange={(v)=>setForm({...form,active:v})}/></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>الاسم</TableHead><TableHead>الحد الأدنى</TableHead><TableHead>اللون</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((l: any) => (
              <TableRow key={l.id}>
                <TableCell>{l.order_index}</TableCell>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell>{l.min_points}</TableCell>
                <TableCell><div className="h-6 w-6 rounded-full" style={{ background: l.color }}/></TableCell>
                <TableCell>{l.active ? <Badge>مفعّل</Badge> : <Badge variant="outline">موقوف</Badge>}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={()=>openEdit(l)}><Pencil className="h-3 w-3"/></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={()=>remove(l.id)}><Trash2 className="h-3 w-3"/></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Rules ---------------------------- */
function RulesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["point_rules"], queryFn: async () => (await supabase.from("point_rules").select("*").order("kind").order("label")).data ?? [] });
  const update = async (id: string, patch: any) => {
    await supabase.from("point_rules").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["point_rules"] });
  };
  return (
    <Card>
      <CardHeader><CardTitle>قواعد النقاط</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>الحدث</TableHead><TableHead>المفتاح</TableHead><TableHead>النقاط</TableHead><TableHead>النوع</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.key}</TableCell>
                <TableCell><Input type="number" defaultValue={r.points} onBlur={(e)=>update(r.id,{points:+e.target.value})} className="w-24"/></TableCell>
                <TableCell><Badge variant={r.kind==="earn" ? "default" : "destructive"}>{r.kind==="earn"?"إضافة":"خصم"}</Badge></TableCell>
                <TableCell><Switch checked={r.active} onCheckedChange={(v)=>update(r.id,{active:v})}/></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
