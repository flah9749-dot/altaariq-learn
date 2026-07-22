import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { broadcastMessage } from "@/lib/messaging.functions";

export function BroadcastDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [target, setTarget] = useState<"all" | "class" | "group">("all");
  const [classId, setClassId] = useState<string | undefined>();
  const [groupId, setGroupId] = useState<string | undefined>();
  const [body, setBody] = useState("");
  const fn = useServerFn(broadcastMessage);

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () =>
    (await supabase.from("classes").select("id,name").order("name")).data ?? [] });
  const { data: groups } = useQuery({ queryKey: ["groups-with-class"], queryFn: async () =>
    (await supabase.from("groups").select("id,name,class_id, classes(name)").order("name")).data ?? [] });


  const send = useMutation({
    mutationFn: async () => fn({ data: { body, target, class_id: classId ?? null, group_id: groupId ?? null, student_ids: [], message_type: "text" } }),
    onSuccess: (r: any) => { toast.success(`تم الإرسال إلى ${r.count} طالب`); setBody(""); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader><DialogTitle>رسالة جماعية</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>الفئة المستهدفة</Label>
            <Select value={target} onValueChange={(v: any) => setTarget(v)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الطلاب</SelectItem>
                <SelectItem value="class">فصل محدد</SelectItem>
                <SelectItem value="group">مجموعة محددة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {target === "class" && (
            <div><Label>الفصل</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="اختر فصل"/></SelectTrigger>
                <SelectContent>{(classes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {target === "group" && (
            <div><Label>المجموعة</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="اختر مجموعة"/></SelectTrigger>
                <SelectContent>{(groups ?? []).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>نص الرسالة</Label>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب رسالتك للطلاب..."/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1"/> : <Send className="h-4 w-4 ml-1"/>}
            إرسال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
