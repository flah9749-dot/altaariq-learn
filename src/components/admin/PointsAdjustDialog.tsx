import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { awardPoints } from "@/lib/gamification";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  studentId: string;
  studentName: string;
  currentPoints: number;
  trigger?: React.ReactNode;
  invalidateKeys?: string[];
}

export function PointsAdjustDialog({ studentId, studentName, currentPoints, trigger, invalidateKeys = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const submit = async () => {
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) { toast.error("أدخل قيمة صحيحة (موجبة للإضافة، سالبة للخصم)"); return; }
    if (!reason.trim()) { toast.error("اكتب سبب التعديل"); return; }
    setSaving(true);
    try {
      await awardPoints({ studentId, points: n, reason: reason.trim(), kind: n >= 0 ? "earn" : "deduct" });
      toast.success(n >= 0 ? `تمت إضافة ${n} نقطة` : `تم خصم ${Math.abs(n)} نقطة`);
      setOpen(false); setDelta(""); setReason("");
      qc.invalidateQueries({ queryKey: ["lb-students"] });
      qc.invalidateQueries({ queryKey: ["reports-students"] });
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e: any) {
      toast.error(e?.message ?? "فشل تعديل النقاط");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" variant="outline"><Sparkles className="h-4 w-4 ml-1"/>تعديل النقاط</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>تعديل نقاط: {studentName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">الرصيد الحالي: <span className="font-bold text-primary">{currentPoints}</span> نقطة</p>
          <div>
            <Label>القيمة (+ للإضافة، − للخصم)</Label>
            <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="مثال: 10 أو -5" />
          </div>
          <div>
            <Label>السبب</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تميز في المشاركة" rows={2}/>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[5,10,20,-5,-10].map((v) => (
              <Button key={v} size="sm" variant="secondary" type="button" onClick={() => setDelta(String(v))}>{v > 0 ? `+${v}` : v}</Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
