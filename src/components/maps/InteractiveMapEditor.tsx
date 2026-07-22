import { useRef, useState, useCallback, useEffect } from "react";
import { Trash2, MousePointer2, MapPin, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MapEditorPoint = {
  label: string;
  prompt?: string;
  hint?: string;
  x: number; // 0-100
  y: number; // 0-100
};

type Mode = "add" | "select";

export function InteractiveMapEditor({
  imageUrl,
  points,
  onChange,
}: {
  imageUrl: string;
  points: MapEditorPoint[];
  onChange: (next: MapEditorPoint[]) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<Mode>("add");
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (selected != null && selected >= points.length) setSelected(null);
  }, [points.length, selected]);

  const getPct = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleWrapClick = (e: React.MouseEvent) => {
    if (mode !== "add") return;
    if ((e.target as HTMLElement).closest("[data-marker]")) return;
    const pos = getPct(e);
    if (!pos) return;
    const next = [...points, { label: `الموقع ${points.length + 1}`, prompt: "", hint: "", x: pos.x, y: pos.y }];
    onChange(next);
    setSelected(next.length - 1);
    setMode("select");
  };

  const startDrag = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(idx);
    setDragIdx(idx);
  }, []);

  useEffect(() => {
    if (dragIdx == null) return;
    const move = (ev: MouseEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      onChange(points.map((p, i) => (i === dragIdx ? { ...p, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : p)));
    };
    const up = () => setDragIdx(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragIdx, points, onChange]);

  const updatePoint = (idx: number, patch: Partial<MapEditorPoint>) =>
    onChange(points.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const removePoint = (idx: number) => {
    onChange(points.filter((_, i) => i !== idx));
    setSelected(null);
  };

  const active = selected != null ? points[selected] : null;

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      {/* Canvas */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "add" ? "default" : "outline"}
            onClick={() => setMode("add")}
            title="أضف نقطة بالنقر على الخريطة"
          >
            <MapPin className="h-4 w-4 ml-1" />
            وضع الإضافة
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "select" ? "default" : "outline"}
            onClick={() => setMode("select")}
            title="اختر أو اسحب نقطة"
          >
            <MousePointer2 className="h-4 w-4 ml-1" />
            وضع التحديد
          </Button>
          <div className="mr-auto flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="تصغير">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="tabular-nums">{Math.round(zoom * 100)}%</Badge>
            <Button type="button" size="icon" variant="ghost" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} title="تكبير">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => setZoom(1)} title="إعادة الحجم">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <Badge variant="secondary">{points.length} نقطة</Badge>
        </div>

        <div className="relative overflow-auto rounded-md border bg-slate-950/5 max-h-[70vh]">
          <div
            ref={wrapRef}
            onClick={handleWrapClick}
            style={{
              width: `${zoom * 100}%`,
              cursor: mode === "add" ? "crosshair" : "default",
            }}
            className="relative select-none mx-auto"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="خريطة"
              draggable={false}
              className="block w-full h-auto pointer-events-none"
            />
            {points.map((p, i) => {
              const isSel = i === selected;
              return (
                <button
                  key={i}
                  type="button"
                  data-marker
                  onMouseDown={(e) => startDrag(i, e)}
                  onClick={(e) => { e.stopPropagation(); setSelected(i); setMode("select"); }}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full font-bold text-white shadow-lg border-2 transition-all",
                    isSel
                      ? "h-9 w-9 text-sm bg-red-600 border-white ring-4 ring-red-400/50 z-20"
                      : "h-7 w-7 text-xs bg-slate-900 border-white hover:scale-110 z-10",
                    dragIdx === i && "cursor-grabbing",
                  )}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  title={p.label}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "add"
            ? "🖱️ انقر على الخريطة لإضافة رقم جديد على الموقع."
            : "🖱️ اسحب النقاط لتعديل مواقعها، أو انقر لتحديدها وتعديل بياناتها."}
        </p>
      </div>

      {/* Side panel */}
      <div className="space-y-2">
        <div className="rounded-md border bg-muted/30 p-3 space-y-2 max-h-[70vh] overflow-auto">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">قائمة النقاط</Label>
            <Badge variant="outline">{points.length}</Badge>
          </div>
          {points.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              لا توجد نقاط بعد. فعّل «وضع الإضافة» ثم انقر على الخريطة لإضافة أول نقطة، أو استخدم زر «تحليل بالذكاء الاصطناعي» في الأعلى.
            </p>
          ) : (
            <ul className="space-y-1">
              {points.map((p, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => { setSelected(i); setMode("select"); }}
                    className={cn(
                      "w-full text-right rounded border px-2 py-1.5 text-xs flex items-center gap-2 hover:bg-accent transition-colors",
                      selected === i && "bg-accent border-primary",
                    )}
                  >
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-900 text-white font-bold text-[11px]">{i + 1}</span>
                    <span className="flex-1 truncate">{p.label || <em className="text-muted-foreground">بدون اسم</em>}</span>
                    <Trash2
                      className="h-3.5 w-3.5 text-destructive hover:scale-110"
                      onClick={(e) => { e.stopPropagation(); removePoint(i); }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {active && selected != null && (
          <div className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">تعديل النقطة #{selected + 1}</Label>
              <Button size="sm" variant="ghost" onClick={() => removePoint(selected)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الإجابة الصحيحة *</Label>
              <Input value={active.label} onChange={(e) => updatePoint(selected, { label: e.target.value })} placeholder="مثال: جبال الأطلس" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">السؤال</Label>
              <Textarea rows={2} value={active.prompt ?? ""} onChange={(e) => updatePoint(selected, { prompt: e.target.value })} placeholder="مثال: ما اسم السلسلة الجبلية عند الرقم ١؟" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تلميح (اختياري)</Label>
              <Input value={active.hint ?? ""} onChange={(e) => updatePoint(selected, { hint: e.target.value })} placeholder="مثال: تقع في شمال غرب أفريقيا" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">X (%)</Label>
                <Input type="number" min={0} max={100} step="0.1" value={active.x} onChange={(e) => updatePoint(selected, { x: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
              </div>
              <div className="space-y-1"><Label className="text-xs">Y (%)</Label>
                <Input type="number" min={0} max={100} step="0.1" value={active.y} onChange={(e) => updatePoint(selected, { y: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
