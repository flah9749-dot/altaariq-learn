import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Map, Plus, Trash2, Search, ImagePlus, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listMapTemplates, upsertMapTemplate, deleteMapTemplate } from "@/lib/map-templates.functions";

export const Route = createFileRoute("/admin/maps")({
  head: () => ({
    meta: [
      { title: "مكتبة الخرائط | الطارق التعليمية" },
      { name: "description", content: "مكتبة خرائط تفاعلية جاهزة لإعادة الاستخدام في امتحانات الدراسات الاجتماعية." },
    ],
  }),
  component: MapsLibrary,
});

async function fileToDataUrl(file: File): Promise<string> {
  const { compressImage } = await import("@/lib/message-utils");
  const blob = await compressImage(file, 1800, 0.85);
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result ?? ""));
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function MapsLibrary() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMapTemplates);
  const saveFn = useServerFn(upsertMapTemplate);
  const delFn = useServerFn(deleteMapTemplate);
  const [search, setSearch] = useState("");
  const [openEditor, setOpenEditor] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["map-templates"],
    queryFn: () => listFn(),
  });

  const filtered = useMemo(() => {
    const list = templates ?? [];
    if (!search.trim()) return list;
    const s = search.trim().toLowerCase();
    return list.filter((t: any) =>
      (t.title ?? "").toLowerCase().includes(s) || (t.category ?? "").toLowerCase().includes(s),
    );
  }, [templates, search]);

  const saveMut = useMutation({
    mutationFn: async (payload: any) => saveFn({ data: payload }),
    onSuccess: () => {
      toast.success("تم حفظ القالب");
      qc.invalidateQueries({ queryKey: ["map-templates"] });
      setOpenEditor(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["map-templates"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const openNew = () => { setEditing({ title: "", category: "", description: "", image_url: "", points: [] }); setOpenEditor(true); };
  const openExisting = (t: any) => {
    setEditing({
      id: t.id, title: t.title, category: t.category ?? "", description: t.description ?? "",
      image_url: t.image_url, points: Array.isArray(t.data?.points) ? t.data.points : [],
    });
    setOpenEditor(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Map className="h-6 w-6 text-primary" /> مكتبة الخرائط</h1>
        <div className="mr-auto flex gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..." className="pr-8 w-56" />
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 ml-1" />قالب جديد</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          {search ? "لا نتائج للبحث." : "لا توجد قوالب بعد. أنشئ قالبك الأول لتسريع إنشاء أسئلة الخرائط."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t: any) => (
            <Card key={t.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openExisting(t)}>
              <div className="relative bg-muted h-40">
                {t.image_url ? <img src={t.image_url} alt={t.title} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">لا توجد صورة</div>}
                <Badge className="absolute top-2 right-2">{(t.data?.points?.length ?? 0)} نقطة</Badge>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.title}</CardTitle>
                {t.category && <p className="text-xs text-muted-foreground">{t.category}</p>}
              </CardHeader>
              <CardContent className="pt-0 flex items-center justify-between">
                <p className="text-xs text-muted-foreground line-clamp-2">{t.description ?? ""}</p>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("حذف القالب؟")) delMut.mutate(t.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openEditor} onOpenChange={(v) => { setOpenEditor(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل قالب الخريطة" : "قالب خريطة جديد"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5"><Label>العنوان *</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>التصنيف</Label><Input placeholder="مثال: مصر، العالم، تاريخ..." value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>الوصف</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>

              <div className="space-y-2">
                <Label>صورة الخريطة *</Label>
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <Input value={editing.image_url ?? ""} placeholder="رابط أو ارفع صورة" onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} />
                  <Button asChild variant="outline">
                    <label className="cursor-pointer"><ImagePlus className="h-4 w-4 ml-1" />رفع
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        if (f.size > 50 * 1024 * 1024) { toast.error("الحجم أكبر من 50MB"); return; }
                        try { setEditing((p: any) => ({ ...p, image_url: "..." })); const url = await fileToDataUrl(f); setEditing((p: any) => ({ ...p, image_url: url })); }
                        catch { toast.error("فشل تحميل الصورة"); }
                        finally { (e.target as HTMLInputElement).value = ""; }
                      }} />
                    </label>
                  </Button>
                </div>
                {editing.image_url && editing.image_url !== "..." && <img src={editing.image_url} alt="preview" className="max-h-56 rounded border" />}
              </div>

              <div className="space-y-2 border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label>النقاط ({editing.points.length})</Label>
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, points: [...editing.points, { label: `الموقع ${editing.points.length + 1}`, prompt: "", x: 50, y: 50 }] })}>
                    <Plus className="h-3 w-3 ml-1" />نقطة
                  </Button>
                </div>
                {editing.points.map((p: any, i: number) => (
                  <div key={i} className="grid gap-2 md:grid-cols-[32px_1fr_1fr_80px_80px_auto] items-center border rounded p-2 bg-background">
                    <Badge variant="outline" className="justify-center">{i + 1}</Badge>
                    <Input placeholder="السؤال (اختياري)" value={p.prompt ?? ""} onChange={(e) => { const n = [...editing.points]; n[i] = { ...n[i], prompt: e.target.value }; setEditing({ ...editing, points: n }); }} />
                    <Input placeholder="الإجابة" value={p.label ?? ""} onChange={(e) => { const n = [...editing.points]; n[i] = { ...n[i], label: e.target.value }; setEditing({ ...editing, points: n }); }} />
                    <Input type="number" min={0} max={100} step="0.1" value={p.x} onChange={(e) => { const n = [...editing.points]; n[i] = { ...n[i], x: Number(e.target.value) }; setEditing({ ...editing, points: n }); }} />
                    <Input type="number" min={0} max={100} step="0.1" value={p.y} onChange={(e) => { const n = [...editing.points]; n[i] = { ...n[i], y: Number(e.target.value) }; setEditing({ ...editing, points: n }); }} />
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ ...editing, points: editing.points.filter((_: any, k: number) => k !== i) })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenEditor(false); setEditing(null); }}>إلغاء</Button>
            <Button onClick={() => {
              if (!editing?.title?.trim() || !editing?.image_url) { toast.error("العنوان وصورة الخريطة مطلوبان"); return; }
              saveMut.mutate({
                id: editing.id,
                title: editing.title.trim(),
                category: editing.category?.trim() || null,
                description: editing.description?.trim() || null,
                image_url: editing.image_url,
                points: editing.points ?? [],
              });
            }} disabled={saveMut.isPending}>
              <Save className="h-4 w-4 ml-1" />حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
