import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createStudent, updateStudent } from "@/lib/students.functions";
import { generateStudentCode, type StudentRow } from "@/lib/students-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  student?: StudentRow | null;
}

export function StudentFormDialog({ open, onOpenChange, student }: Props) {
  const isEdit = !!student;
  const qc = useQueryClient();
  const createFn = useServerFn(createStudent);
  const updateFn = useServerFn(updateStudent);

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) {
      setForm(
        student
          ? { ...student, password: "" }
          : {
              full_name: "", code: generateStudentCode(), password: "",
              gender: null, birth_date: null, class_id: null, group_id: null,
              seat_number: "", phone: "", parent_name: "", parent_phone: "",
              parent_whatsapp: "", address: "", notes: "",
            },
      );
    }
  }, [open, student]);

  const { data: classes } = useQuery({
    queryKey: ["classes-select"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });
  const { data: groups } = useQuery({
    queryKey: ["groups-select", form.class_id],
    queryFn: async () => {
      let q = supabase.from("groups").select("id,name,class_id");
      if (form.class_id) q = q.eq("class_id", form.class_id);
      return (await q.order("name")).data ?? [];
    },
  });

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name,
        code: form.code,
        password: form.password || null,
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        class_id: form.class_id || null,
        group_id: form.group_id || null,
        seat_number: form.seat_number || null,
        phone: form.phone || null,
        parent_name: form.parent_name || null,
        parent_phone: form.parent_phone || null,
        parent_whatsapp: form.parent_whatsapp || form.parent_phone || null,
        address: form.address || null,
        notes: form.notes || null,
      };
      if (isEdit) return updateFn({ data: { id: student!.id, patch: payload } });
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(isEdit ? "تم تحديث الطالب" : "تم إضافة الطالب");
      qc.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "حدث خطأ"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل بيانات الطالب" : "إضافة طالب جديد"}</DialogTitle>
          <DialogDescription>املأ الحقول التالية لحفظ بيانات الطالب.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal">شخصية</TabsTrigger>
            <TabsTrigger value="study">دراسية</TabsTrigger>
            <TabsTrigger value="auth">الدخول</TabsTrigger>
            <TabsTrigger value="contact">التواصل</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-3 mt-4">
            <Field label="الاسم بالكامل *"><Input value={form.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="الجنس">
                <Select value={form.gender ?? ""} onValueChange={(v) => set("gender", v || null)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="تاريخ الميلاد"><Input type="date" value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} /></Field>
            </div>
            <Field label="العنوان"><Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
            <Field label="ملاحظات"><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
          </TabsContent>

          <TabsContent value="study" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="الصف الدراسي">
                <Select value={form.class_id ?? ""} onValueChange={(v) => { set("class_id", v || null); set("group_id", null); }}>
                  <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                  <SelectContent>
                    {(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="المجموعة">
                <Select value={form.group_id ?? ""} onValueChange={(v) => set("group_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="اختر المجموعة" /></SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="رقم الجلوس"><Input value={form.seat_number ?? ""} onChange={(e) => set("seat_number", e.target.value)} /></Field>
          </TabsContent>

          <TabsContent value="auth" className="space-y-3 mt-4">
            <Field label="كود الطالب *">
              <div className="flex gap-2">
                <Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} disabled={isEdit && !!student?.code} />
                {!isEdit && (
                  <Button type="button" variant="outline" size="icon" onClick={() => set("code", generateStudentCode())}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Field>
            <Field label={isEdit ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور (اتركها فارغة لاستخدام الكود)"}>
              <Input type="text" value={form.password ?? ""} onChange={(e) => set("password", e.target.value)} placeholder={isEdit ? "لا تغيّر" : form.code} />
            </Field>
          </TabsContent>

          <TabsContent value="contact" className="space-y-3 mt-4">
            <Field label="رقم هاتف الطالب"><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="اسم ولي الأمر"><Input value={form.parent_name ?? ""} onChange={(e) => set("parent_name", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="هاتف ولي الأمر"><Input value={form.parent_phone ?? ""} onChange={(e) => set("parent_phone", e.target.value)} /></Field>
              <Field label="واتساب ولي الأمر"><Input value={form.parent_whatsapp ?? ""} onChange={(e) => set("parent_whatsapp", e.target.value)} placeholder="نفس الهاتف إن لم يُحدد" /></Field>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.full_name || !form.code}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {isEdit ? "حفظ التعديلات" : "إضافة الطالب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
