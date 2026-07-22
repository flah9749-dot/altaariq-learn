import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight, Upload, Sparkles, Loader2, Trash2, Wand2, Save, ImagePlus, MapPin, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { InteractiveMapEditor } from "@/components/maps/InteractiveMapEditor";
import { MapPointQuestions } from "@/components/exams/MapPointQuestions";
import { autoBuildMapPage, createMapExam } from "@/lib/map-exam.functions";
import type { MapSubQuestion } from "@/lib/exam-utils";

export const Route = createFileRoute("/admin/exams/map/new")({
  head: () => ({ meta: [{ title: "امتحان خرائط ذكي — إنشاء" }] }),
  component: NewMapExamPage,
});

type PagePoint = {
  label: string;
  prompt: string;
  hint: string;
  x: number;
  y: number;
  questions: MapSubQuestion[];
};

type MapPage = {
  id: string;
  title: string;
  original_url: string | null;
  image_url: string;
  points: PagePoint[];
  building: boolean;
};

function newPageId() { return `p_${Math.random().toString(36).slice(2, 9)}`; }

function NewMapExamPage() {
  const nav = useNavigate();
  const buildFn = useServerFn(autoBuildMapPage);
  const createFn = useServerFn(createMapExam);

  const [title, setTitle] = useState("امتحان خرائط ذكي");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState<string>("all");
  const [groupId, setGroupId] = useState<string>("all");
  const [duration, setDuration] = useState(30);
  const [publish, setPublish] = useState(false);
  const [pages, setPages] = useState<MapPage[]>([]);
  const [saving, setSaving] = useState(false);
  const [maxPoints, setMaxPoints] = useState(8);
  const [focus, setFocus] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });
  const { data: groups } = useQuery({
    queryKey: ["groups-with-class"],
    queryFn: async () => (await supabase.from("groups").select("id,name,class_id").order("name")).data ?? [],
  });

  const filteredGroups = useMemo(
    () => classId === "all" ? [] : (groups ?? []).filter((g: any) => g.class_id === classId),
    [groups, classId],
  );

  const totalPts = useMemo(
    () => pages.reduce((s, pg) => s + pg.points.reduce((a, p) => {
      const per = p.questions.reduce((x, q) => x + (Number(q.points) || 0), 0);
      return a + (per > 0 ? per : 1);
    }, 0), 0),
    [pages],
  );

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }

  async function handleUploadPages(files: FileList | null) {
    if (!files || files.length === 0) return;
    const toAdd: MapPage[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { toast.error(`${f.name}: ليست صورة`); continue; }
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: أكبر من 20MB`); continue; }
      const url = await fileToDataUrl(f);
      toAdd.push({
        id: newPageId(),
        title: f.name.replace(/\.[^.]+$/, "") || "خريطة",
        original_url: url,
        image_url: url,
        points: [],
        building: false,
      });
    }
    setPages((p) => [...p, ...toAdd]);
    if (toAdd.length) toast.success(`تمت إضافة ${toAdd.length} صفحة/خريطة`);
  }

  async function buildPage(idx: number) {
    const pg = pages[idx];
    if (!pg?.original_url) { toast.error("لا توجد صورة"); return; }
    setPages((arr) => arr.map((p, i) => i === idx ? { ...p, building: true } : p));
    try {
      // Build a labeled reference grid client-side so the AI can pick a cell
      // (e.g. "H14") instead of guessing raw pixel coordinates.
      let gridImage: string | undefined;
      let gridCols: number | undefined;
      let gridRows: number | undefined;
      try {
        const { buildGridOverlay } = await import("@/lib/map-grid");
        const g = await buildGridOverlay(pg.original_url, 20, 20);
        gridImage = g.dataUrl;
        gridCols = g.info.cols;
        gridRows = g.info.rows;
      } catch { /* fall back to non-grid analysis */ }

      // Try grid-based analysis first; if it fails (payload too big, transient
      // gateway error, model glitch), automatically retry without the grid.
      let r: any;
      try {
        r = await buildFn({ data: {
          image_data_url: pg.original_url,
          max_points: maxPoints,
          focus: focus || "",
          grid_image_data_url: gridImage,
          grid_cols: gridCols,
          grid_rows: gridRows,
        } });
      } catch (err) {
        if (gridImage) {
          console.warn("[map-exam] grid path failed, retrying without grid:", err);
          r = await buildFn({ data: {
            image_data_url: pg.original_url,
            max_points: maxPoints,
            focus: focus || "",
          } });
        } else {
          throw err;
        }
      }
      setPages((arr) => arr.map((p, i) => i === idx ? {
        ...p,
        title: p.title === "خريطة" || !p.title ? r.title : p.title,
        image_url: r.image_url_clean || p.image_url,
        points: r.points,
        building: false,
      } : p));
      toast.success(`تم توليد ${r.points.length} نقطة`);
    } catch (e: any) {
      console.error("[map-exam] buildPage failed:", e);
      toast.error(e?.message ?? "فشل التوليد");
      setPages((arr) => arr.map((p, i) => i === idx ? { ...p, building: false } : p));
    }
  }

  function removePage(idx: number) {
    setPages((p) => p.filter((_, i) => i !== idx));
  }

  function updatePagePoints(idx: number, next: PagePoint[]) {
    setPages((arr) => arr.map((p, i) => i === idx ? { ...p, points: next } : p));
  }

  function updatePointQuestions(pi: number, ptIdx: number, qs: MapSubQuestion[]) {
    setPages((arr) => arr.map((p, i) => i === pi ? {
      ...p,
      points: p.points.map((pt, j) => j === ptIdx ? { ...pt, questions: qs } : pt),
    } : p));
  }

  async function save() {
    if (title.trim().length < 2) { toast.error("العنوان قصير"); return; }
    if (!pages.length) { toast.error("أضف خريطة واحدة على الأقل"); return; }
    for (const pg of pages) {
      if (!pg.points.length) { toast.error(`الصفحة "${pg.title}" بدون نقاط`); return; }
    }
    setSaving(true);
    try {
      const r: any = await createFn({ data: {
        title: title.trim(),
        description,
        class_id: classId === "all" ? null : classId,
        group_ids: groupId === "all" ? [] : [groupId],
        duration_minutes: duration,
        publish,
        pages: pages.map((pg) => ({
          title: pg.title,
          image_url: pg.image_url,
          points: pg.points,
        })),
      } });
      toast.success("تم إنشاء الامتحان");
      nav({ to: "/admin/exams/$id", params: { id: r.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            امتحان الخرائط الذكي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ارفع خرائط → يقوم الذكاء الاصطناعي بالتنظيف والتحليل وتوليد الأسئلة → راجع واحفظ.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/exams"><ArrowRight className="h-4 w-4 ml-1" />رجوع</Link>
        </Button>
      </div>

      {/* Step 1 — basics */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">١. بيانات الامتحان</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>عنوان الامتحان *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: خرائط قارات العالم" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>وصف مختصر (اختياري)</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الصف المستهدف</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setGroupId("all"); }}>
              <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الصفوف</SelectItem>
                {(classes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>المجموعة المستهدفة</Label>
            <Select value={groupId} onValueChange={setGroupId} disabled={classId === "all" || filteredGroups.length === 0}>
              <SelectTrigger><SelectValue placeholder={classId === "all" ? "اختر الصف أولاً" : "كل المجموعات"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل مجموعات الصف</SelectItem>
                {filteredGroups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>المدة (بالدقائق)</Label>
            <Input type="number" min={1} max={600} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 30)} />
          </div>
          <div className="flex items-center gap-3 md:col-span-2 rounded-md border p-3">
            <Switch checked={publish} onCheckedChange={setPublish} />
            <Label className="!m-0">نشر الامتحان مباشرةً بعد الحفظ (وإخطار الطلاب)</Label>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — upload maps */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            ٢. ارفع صور الخرائط
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>عدد النقاط لكل خريطة (تلقائي)</Label>
              <Input type="number" min={2} max={25} value={maxPoints} onChange={(e) => setMaxPoints(Math.max(2, Math.min(25, Number(e.target.value) || 8)))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>تركيز التوليد (اختياري)</Label>
              <Input placeholder="مثال: الجبال والأنهار فقط" value={focus} onChange={(e) => setFocus(e.target.value)} />
            </div>
          </div>
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-muted/30 py-8 cursor-pointer hover:bg-muted/50 transition">
            <ImagePlus className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">اضغط لرفع صور الخرائط (يمكن اختيار عدة صور)</span>
            <span className="text-xs text-muted-foreground">JPG / PNG · حتى 20MB لكل ملف</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleUploadPages(e.target.files); e.target.value = ""; }} />
          </label>
        </CardContent>
      </Card>

      {/* Step 3 — per-page review */}
      {pages.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          لم ترفع أي خريطة بعد.
        </CardContent></Card>
      ) : (
        pages.map((pg, pi) => (
          <Card key={pg.id} className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge>خريطة {pi + 1}</Badge>
                <Input className="max-w-sm h-8" value={pg.title} onChange={(e) => setPages((arr) => arr.map((p, i) => i === pi ? { ...p, title: e.target.value } : p))} />
                <div className="mr-auto flex items-center gap-2">
                  <Button size="sm" variant="secondary" disabled={pg.building || !pg.original_url} onClick={() => buildPage(pi)}>
                    {pg.building ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Wand2 className="h-4 w-4 ml-1" />}
                    توليد بالذكاء الاصطناعي
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removePage(pi)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                {pg.original_url && pg.image_url !== pg.original_url && <Badge variant="outline" className="text-[10px]"><Eye className="h-3 w-3 ml-1" />خريطة نظيفة</Badge>}
                {pg.points.length} نقطة · {pg.points.reduce((s, p) => s + p.questions.reduce((a, q) => a + (Number(q.points) || 0), 0), 0)} درجة
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {pg.building && <div className="rounded-md bg-primary/10 text-primary text-sm p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> جاري تنظيف الخريطة وتحليلها وتوليد الأسئلة...
              </div>}

              <InteractiveMapEditor
                imageUrl={pg.image_url}
                points={pg.points.map(({ questions, ...rest }) => rest)}
                onChange={(next) => {
                  // Merge: keep questions arrays by index; new points get default short sub-question
                  const merged: PagePoint[] = next.map((np, i) => {
                    const prev = pg.points[i];
                    if (prev) return { ...prev, ...np };
                    return { ...np, hint: np.hint ?? "", prompt: np.prompt ?? "", questions: [] };
                  });
                  updatePagePoints(pi, merged);
                }}
              />

              {pg.points.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">أسئلة كل نقطة</Label>
                  <div className="grid gap-2">
                    {pg.points.map((pt, ptIdx) => (
                      <details key={ptIdx} className="rounded-md border bg-muted/20">
                        <summary className="cursor-pointer p-2 text-sm flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-900 text-white font-bold text-[11px]">{ptIdx + 1}</span>
                          <span className="flex-1">{pt.label || "بدون اسم"}</span>
                          <Badge variant="outline">{pt.questions.length} سؤال</Badge>
                        </summary>
                        <div className="p-2 pt-0">
                          <MapPointQuestions
                            value={pt.questions}
                            onChange={(qs) => updatePointQuestions(pi, ptIdx, qs)}
                          />
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Save bar */}
      <Card className="sticky bottom-2 shadow-lg border-primary/40">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <div><b>{pages.length}</b> خريطة · <b>{pages.reduce((s, p) => s + p.points.length, 0)}</b> نقطة · <b>{totalPts}</b> درجة</div>
            {publish && <div className="text-xs text-warning">سيتم النشر وإخطار الطلاب فور الحفظ.</div>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/admin/exams">إلغاء</Link></Button>
            <Button onClick={save} disabled={saving || pages.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
              {publish ? "حفظ ونشر" : "حفظ كمسودة"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
