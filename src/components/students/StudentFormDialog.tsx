import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createStudent, updateStudent } from "@/lib/students.functions";
import { generateStudentCode, generateStudentPassword, type StudentRow } from "@/lib/students-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";
import { StudentCardDialog } from "./StudentCardDialog";

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
  const [cardOpen, setCardOpen] = useState(false);
  const [createdStudent, setCreatedStudent] = useState<StudentRow | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ code: string; password: string } | null>(null);

  useEffect(() => {
    if (open) {
      if (student) {
        setForm({ ...student, password: "" });
      } else {
        let code = generateStudentCode();
        let password = generateStudentPassword();
        while (password === code) password = generateStudentPassword();
        setForm({
          full_name: "", code, password,
          phone: "", parent_phone: "",
          class_id: null, group_id: null,
        });
      }
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

  function regenCode() {
    let code = generateStudentCode();
    if (code === form.password) code = generateStudentCode();
    set("code", code);
  }
  function regenPassword() {
    let pw = generateStudentPassword();
    while (pw === form.code) pw = generateStudentPassword();
    set("password", pw);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name,
        code: form.code,
        password: form.password || null,
        phone: form.phone || null,
        parent_phone: form.parent_phone || null,
        parent_whatsapp: form.parent_phone || null,
        class_id: form.class_id || null,
        group_id: form.group_id || null,
      };
      if (isEdit) {
        await updateFn({ data: { id: student!.id, patch: payload } as any });
        return null;
      }
      const res: any = await createFn({ data: payload });
      const newId = res?.id;
      let row: StudentRow | null = null;
      if (newId) {
        const { data } = await supabase.from("students")
          .select("*, classes(id,name), groups(id,name)")
          .eq("id", newId).maybeSingle();
        row = (data as StudentRow) ?? null;
      }
      if (!row) {
        const cls = (classes ?? []).find((c) => c.id === form.class_id) ?? null;
        const grp = (groups ?? []).find((g) => g.id === form.group_id) ?? null;
        row = {
          id: newId ?? "",
          full_name: form.full_name,
          code: form.code,
          phone: form.phone || null,
          parent_phone: form.parent_phone || null,
          parent_whatsapp: form.parent_phone || null,
          class_id: form.class_id || null,
          group_id: form.group_id || null,
          classes: cls,
          groups: grp,
        } as any;
      }
      return { row, creds: { code: form.code, password: form.password } };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.success(isEdit ? "تم تحديث بيانات الطالب" : "تم إضافة الطالب");
      if (isEdit) {
        onOpenChange(false);
        return;
      }
      if (result?.row) {
        setCreatedStudent(result.row);
        setCreatedCreds(result.creds);
        onOpenChange(false);
        setTimeout(() => setCardOpen(true), 80);
      } else {
        onOpenChange(false);
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "حدث خطأ"),
  });

  const canSubmit = !!form.full_name && !!form.code && (isEdit || !!form.password);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{isEdit ? "تعديل بيانات الطالب" : "إضافة طالب جديد"}</DialogTitle>
            <DialogDescription>البيانات الأساسية فقط — يمكنك إضافة تفاصيل إضافية لاحقاً من صفحة الطالب.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Field label="اسم الطالب *">
              <Input value={form.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} placeholder="مثال: محمد أحمد" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="كود الطالب *">
                <div className="flex gap-1">
                  <Input dir="ltr" className="text-left font-mono" value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} disabled={isEdit} />
                  {!isEdit && (
                    <Button type="button" variant="outline" size="icon" onClick={regenCode} title="توليد كود">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Field>
              <Field label={isEdit ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور *"}>
                <div className="flex gap-1">
                  <Input dir="ltr" className="text-left font-mono" value={form.password ?? ""} onChange={(e) => set("password", e.target.value)} />
                  <Button type="button" variant="outline" size="icon" onClick={regenPassword} title="توليد كلمة مرور">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="رقم هاتف الطالب">
                <Input dir="ltr" className="text-left" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="01xxxxxxxxx" />
              </Field>
              <Field label="رقم هاتف ولي الأمر">
                <Input dir="ltr" className="text-left" value={form.parent_phone ?? ""} onChange={(e) => set("parent_phone", e.target.value)} placeholder="01xxxxxxxxx" />
              </Field>
            </div>

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
                <Select value={form.group_id ?? ""} onValueChange={(v) => set("group_id", v || null)} disabled={!form.class_id}>
                  <SelectTrigger><SelectValue placeholder={form.class_id ? "اختر المجموعة" : "اختر الصف أولاً"} /></SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {isEdit ? "حفظ التعديلات" : "إضافة وعرض الكارت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StudentCardDialog open={cardOpen} onOpenChange={setCardOpen} student={createdStudent} credentials={createdCreds} />
    </>
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
