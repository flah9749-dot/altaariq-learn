import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listQuestionBank, createQuestionBankEntry, updateQuestionBankEntry,
  deleteQuestionBankEntry, setBulkVisibility, setBulkTargets, createUploadUrl,
  generateQuestionsWithAI, createExamFromBank,
} from "@/lib/question-bank.functions";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Sparkles, Trash2, Edit, Eye, EyeOff, Upload, FileText,
  Image as ImageIcon, Video, Search, Wand2, ClipboardList, Users,
} from "lucide-react";


export const Route = createFileRoute("/admin/question-bank")({
  head: () => ({ meta: [
    { title: "بنك الأسئلة — الطارق التعليمية" },
    { name: "description", content: "بنك أسئلة الدراسات الاجتماعية: توليد أسئلة، رفع مواد للطلاب، بناء امتحانات." },
  ] }),
  component: QuestionBankPage,
});

const SUBJECTS = [
  { v: "general", l: "عام" },
  { v: "history", l: "تاريخ" },
  { v: "geography", l: "جغرافيا" },
  { v: "citizenship", l: "مواطنة" },
];

function QuestionBankPage() {
  const qc = useQueryClient();
  const list = useServerFn(listQuestionBank);
  const create = useServerFn(createQuestionBankEntry);
  const update = useServerFn(updateQuestionBankEntry);
  const remove = useServerFn(deleteQuestionBankEntry);
  const bulk = useServerFn(setBulkVisibility);
  const bulkTargets = useServerFn(setBulkTargets);
  const genAI = useServerFn(generateQuestionsWithAI);
  const makeExam = useServerFn(createExamFromBank);

  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [entryType, setEntryType] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<any>(null);
  const [openForm, setOpenForm] = useState(false);
  const [openAI, setOpenAI] = useState(false);
  const [openExam, setOpenExam] = useState(false);
  const [openTargets, setOpenTargets] = useState(false);

  const classesQ = useQuery({
    queryKey: ["qb-classes-groups"],
    queryFn: async () => {
      const [cRes, gRes] = await Promise.all([
        supabase.from("classes").select("id,name").order("name"),
        supabase.from("groups").select("id,name,class_id").order("name"),
      ]);
      return { classes: cRes.data ?? [], groups: gRes.data ?? [] };
    },
  });
  const classes = classesQ.data?.classes ?? [];
  const groups = classesQ.data?.groups ?? [];

  const q = useQuery({
    queryKey: ["question-bank", { search, subject, entryType }],
    queryFn: () => list({ data: { search, subject, entry_type: entryType } }),
  });


  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["question-bank"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const bulkMut = useMutation({
    mutationFn: (visibility: "private" | "students") =>
      bulk({ data: { ids: Array.from(selected), visibility } }),
    onSuccess: (_, v) => {
      toast.success(v === "students" ? "أصبحت متاحة للطلاب" : "أصبحت خاصة");
      setSelected(new Set()); qc.invalidateQueries({ queryKey: ["question-bank"] });
    },
  });

  const toggleSel = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const entries = q.data ?? [];
  const materialsCount = useMemo(() => entries.filter((e) => e.entry_type === "material").length, [entries]);
  const questionsCount = entries.length - materialsCount;

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">بنك الأسئلة</h1>
          <p className="text-sm text-muted-foreground">
            {questionsCount} سؤال · {materialsCount} مادة مرجعية
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
            <Plus className="w-4 h-4 ml-1" /> إضافة يدوية
          </Button>
          <Button variant="outline" onClick={() => setOpenAI(true)}>
            <Sparkles className="w-4 h-4 ml-1" /> توليد بالذكاء الاصطناعي
          </Button>
          {selected.size > 0 && (
            <>
              <Button variant="secondary" onClick={() => bulkMut.mutate("students")}>
                <Eye className="w-4 h-4 ml-1" /> إتاحة للطلاب ({selected.size})
              </Button>
              <Button variant="ghost" onClick={() => bulkMut.mutate("private")}>
                <EyeOff className="w-4 h-4 ml-1" /> جعلها خاصة
              </Button>
              <Button variant="outline" onClick={() => setOpenTargets(true)}>
                <Users className="w-4 h-4 ml-1" /> استهداف صفوف/مجموعات
              </Button>
              <Button variant="default" onClick={() => setOpenExam(true)}>
                <ClipboardList className="w-4 h-4 ml-1" /> إنشاء امتحان ({selected.size})
              </Button>

            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالعنوان" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-8" />
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-40"><SelectValue placeholder="المادة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المواد</SelectItem>
              {SUBJECTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entryType} onValueChange={setEntryType}>
            <SelectTrigger className="w-40"><SelectValue placeholder="النوع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="question">أسئلة</SelectItem>
              <SelectItem value="material">مواد للطلاب</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {q.isLoading && <div className="text-center text-muted-foreground py-8">جارٍ التحميل…</div>}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => (
          <Card key={e.id} className={selected.has(e.id) ? "ring-2 ring-primary" : ""}>
            <CardHeader className="p-3 pb-2 flex-row items-start gap-2 space-y-0">
              <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleSel(e.id)} className="mt-1" />
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm truncate">{e.title}</CardTitle>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {e.entry_type === "material" ? "مادة" : e.question_type ?? "سؤال"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {SUBJECTS.find((s) => s.v === e.subject)?.l ?? e.subject}
                  </Badge>
                  {e.visibility === "students" && (
                    <Badge className="text-[10px] bg-green-600">
                      <Eye className="w-2.5 h-2.5 ml-0.5" /> للطلاب
                    </Badge>
                  )}
                  {e.source === "ai_generated" && (
                    <Badge className="text-[10px] bg-purple-600">
                      <Sparkles className="w-2.5 h-2.5 ml-0.5" /> AI
                    </Badge>
                  )}
                  {(e.class_ids?.length ?? 0) === 0 && (e.group_ids?.length ?? 0) === 0 ? (
                    e.visibility === "students" && (
                      <Badge variant="outline" className="text-[10px]">كل الطلاب</Badge>
                    )
                  ) : (
                    <>
                      {(e.class_ids ?? []).map((cid) => {
                        const cName = classes.find((c) => c.id === cid)?.name ?? "صف";
                        return <Badge key={cid} variant="outline" className="text-[10px]">🎓 {cName}</Badge>;
                      })}
                      {(e.group_ids ?? []).map((gid) => {
                        const gName = groups.find((g) => g.id === gid)?.name ?? "مجموعة";
                        return <Badge key={gid} variant="outline" className="text-[10px]">👥 {gName}</Badge>;
                      })}
                    </>
                  )}
                </div>

              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {e.description && <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>}
              {e.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {e.attachments.slice(0, 3).map((a, i) => (
                    <a
                      key={i} href={a.url ?? "#"} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] bg-muted rounded px-2 py-0.5 hover:bg-muted/70"
                    >
                      {a.mime?.startsWith("image/") ? <ImageIcon className="w-3 h-3" /> :
                       a.mime?.startsWith("video/") ? <Video className="w-3 h-3" /> :
                       <FileText className="w-3 h-3" />}
                      <span className="truncate max-w-[100px]">{a.name}</span>
                    </a>
                  ))}
                  {e.attachments.length > 3 && <span className="text-xs text-muted-foreground">+{e.attachments.length - 3}</span>}
                </div>
              )}
              <div className="flex gap-1 justify-end pt-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpenForm(true); }}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  if (confirm("حذف هذا العنصر؟")) removeMut.mutate(e.id);
                }}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!q.isLoading && entries.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              لا توجد عناصر بعد. ابدأ بإضافة سؤال أو توليد أسئلة بالذكاء الاصطناعي.
            </CardContent>
          </Card>
        )}
      </div>

      {/* --- Manual form --- */}
      <EntryFormDialog
        open={openForm} onOpenChange={setOpenForm} editing={editing}
        classes={classes} groups={groups}
        onSave={async (payload: any) => {
          try {
            if (editing) await update({ data: { ...payload, id: editing.id } });
            else await create({ data: payload });
            toast.success("تم الحفظ");
            qc.invalidateQueries({ queryKey: ["question-bank"] });
            setOpenForm(false);
          } catch (e: any) { toast.error(e?.message ?? "فشل الحفظ"); }
        }}
      />

      {/* --- Bulk targets --- */}
      <BulkTargetsDialog
        open={openTargets} onOpenChange={setOpenTargets}
        count={selected.size} classes={classes} groups={groups}
        onApply={async (cIds: string[], gIds: string[]) => {
          try {
            await bulkTargets({ data: { ids: Array.from(selected), class_ids: cIds, group_ids: gIds } });
            toast.success("تم تحديث الاستهداف");
            qc.invalidateQueries({ queryKey: ["question-bank"] });
            setOpenTargets(false); setSelected(new Set());
          } catch (e: any) { toast.error(e?.message ?? "فشل التحديث"); }
        }}
      />


      {/* --- AI generation --- */}
      <AiGenerateDialog
        open={openAI} onOpenChange={setOpenAI}
        onGenerate={async (payload: any) => {
          try {
            const r = await genAI({ data: payload });
            toast.success(`تم توليد ${r.count} سؤال${r.cached ? " (من الكاش)" : ""}`);
            qc.invalidateQueries({ queryKey: ["question-bank"] });
            setOpenAI(false);
          } catch (e: any) { toast.error(e?.message ?? "فشل التوليد"); }
        }}
      />

      {/* --- Create exam from selected --- */}
      <ExamFromBankDialog
        open={openExam} onOpenChange={setOpenExam} count={selected.size}
        onCreate={async (title: string, duration: number) => {
          try {
            const r = await makeExam({ data: { title, bank_ids: Array.from(selected), duration_minutes: duration } });
            toast.success("تم إنشاء الامتحان (مسودة)");
            setSelected(new Set()); setOpenExam(false);
            window.location.href = `/admin/exams/${r.exam_id}`;
          } catch (e: any) { toast.error(e?.message ?? "فشل الإنشاء"); }
        }}
      />
    </div>
  );
}

// --------- Sub-dialogs ---------

function EntryFormDialog({ open, onOpenChange, editing, onSave, classes = [], groups = [] }: any) {
  const uploadFn = useServerFn(createUploadUrl);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [entryType, setEntryType] = useState<"question" | "material">("question");
  const [questionType, setQuestionType] = useState<"mcq" | "true_false" | "short" | "essay" | "map" | "none">("mcq");
  const [subject, setSubject] = useState("general");
  const [visibility, setVisibility] = useState<"private" | "students">("private");
  const [text, setText] = useState("");
  const [options, setOptions] = useState<{ text: string; is_correct: boolean }[]>([
    { text: "", is_correct: true }, { text: "", is_correct: false },
    { text: "", is_correct: false }, { text: "", is_correct: false },
  ]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);


  // reset on open
  useMemo(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title ?? "");
      setDescription(editing.description ?? "");
      setEntryType(editing.entry_type ?? "question");
      setQuestionType(editing.question_type ?? "mcq");
      setSubject(editing.subject ?? "general");
      setVisibility(editing.visibility ?? "private");
      setText(editing.content?.text ?? "");
      setOptions(editing.content?.options?.length ? editing.content.options :
        [{ text: "", is_correct: true }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }]);
      setCorrectAnswer(editing.content?.correct_answer ?? "");
      setExplanation(editing.content?.explanation ?? "");
      setBody(editing.content?.body ?? "");
      setAttachments(editing.attachments ?? []);
      setClassIds(editing.class_ids ?? []);
      setGroupIds(editing.group_ids ?? []);
    } else {
      setTitle(""); setDescription(""); setEntryType("question"); setQuestionType("mcq");
      setSubject("general"); setVisibility("private");
      setText(""); setOptions([{ text: "", is_correct: true }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }]);
      setCorrectAnswer(""); setExplanation(""); setBody(""); setAttachments([]);
      setClassIds([]); setGroupIds([]);
    }

  }, [open, editing]);

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const { path, token } = await uploadFn({ data: { filename: file.name } });
      const { error } = await supabase.storage.from("question-bank").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      setAttachments((prev) => [...prev, { path, name: file.name, mime: file.type, size: file.size }]);
      toast.success("تم رفع الملف");
    } catch (e: any) { toast.error(e?.message ?? "فشل الرفع"); }
    finally { setUploading(false); }
  };

  const submit = () => {
    const content: any = entryType === "material"
      ? { body }
      : { text, explanation, correct_answer: correctAnswer };
    if (entryType === "question" && questionType === "mcq") content.options = options.filter((o) => o.text.trim());

    onSave({
      title: title || text.slice(0, 100) || "بدون عنوان",
      description: description || null,
      entry_type: entryType,
      question_type: entryType === "question" && questionType !== "none" ? questionType : null,
      content,
      attachments,
      subject,
      difficulty: "medium",
      points: 1,
      tags: [],
      visibility,
      class_ids: classIds,
      group_ids: groupIds,
    });
  };

  const availableGroups = classIds.length > 0
    ? groups.filter((g: any) => classIds.includes(g.class_id))
    : groups;
  const toggleId = (arr: string[], id: string, setter: (v: string[]) => void) =>
    setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل" : "إضافة جديدة"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>النوع</Label>
              <Select value={entryType} onValueChange={(v: any) => setEntryType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">سؤال</SelectItem>
                  <SelectItem value="material">مادة مرجعية للطلاب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المادة</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان مختصر" />
          </div>

          <div>
            <Label>الوصف (اختياري)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف موجز" />
          </div>

          {entryType === "question" && (
            <>
              <div>
                <Label>نوع السؤال</Label>
                <Select value={questionType} onValueChange={(v: any) => setQuestionType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">اختيار من متعدد</SelectItem>
                    <SelectItem value="true_false">صح / خطأ</SelectItem>
                    <SelectItem value="short">إجابة قصيرة</SelectItem>
                    <SelectItem value="essay">مقالي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>نص السؤال</Label>
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
              </div>

              {questionType === "mcq" ? (
                <div className="space-y-2">
                  <Label>الخيارات (حدد الصحيح)</Label>
                  {options.map((o, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Checkbox checked={o.is_correct} onCheckedChange={(v) => {
                        const n = [...options]; n[i].is_correct = !!v; setOptions(n);
                      }} />
                      <Input value={o.text} onChange={(e) => {
                        const n = [...options]; n[i].text = e.target.value; setOptions(n);
                      }} placeholder={`الخيار ${i + 1}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <Label>الإجابة الصحيحة</Label>
                  <Input value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
                </div>
              )}

              <div>
                <Label>الشرح (اختياري)</Label>
                <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} />
              </div>
            </>
          )}

          {entryType === "material" && (
            <div>
              <Label>محتوى المادة</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
            </div>
          )}

          <div>
            <Label>المرفقات (صور / فيديو / PDF / أي ملف)</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {attachments.map((a, i) => (
                <div key={i} className="text-xs bg-muted rounded px-2 py-1 flex items-center gap-1">
                  {a.mime?.startsWith("image/") ? <ImageIcon className="w-3 h-3" /> :
                   a.mime?.startsWith("video/") ? <Video className="w-3 h-3" /> :
                   <FileText className="w-3 h-3" />}
                  <span className="truncate max-w-[140px]">{a.name}</span>
                  <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 mt-2 cursor-pointer text-sm text-primary">
              <Upload className="w-4 h-4" /> {uploading ? "جارٍ الرفع…" : "رفع ملف"}
              <input type="file" hidden accept="image/*,video/*,application/pdf,application/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Checkbox checked={visibility === "students"} onCheckedChange={(v) => setVisibility(v ? "students" : "private")} />
            <Label className="cursor-pointer">إتاحة للطلاب</Label>
          </div>

          {visibility === "students" && (
            <div className="space-y-3 rounded-md border p-3 bg-muted/30">
              <div>
                <Label className="text-xs font-semibold">استهداف الصفوف (فارغ = كل الصفوف)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {classes.length === 0 && <span className="text-xs text-muted-foreground">لا توجد صفوف</span>}
                  {classes.map((c: any) => (
                    <label key={c.id} className={`flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer ${classIds.includes(c.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                      <Checkbox checked={classIds.includes(c.id)} onCheckedChange={() => toggleId(classIds, c.id, setClassIds)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">استهداف المجموعات (فارغ = كل المجموعات)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableGroups.length === 0 && <span className="text-xs text-muted-foreground">لا توجد مجموعات{classIds.length > 0 ? " للصفوف المختارة" : ""}</span>}
                  {availableGroups.map((g: any) => (
                    <label key={g.id} className={`flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer ${groupIds.includes(g.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                      <Checkbox checked={groupIds.includes(g.id)} onCheckedChange={() => toggleId(groupIds, g.id, setGroupIds)} />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={uploading}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiGenerateDialog({ open, onOpenChange, onGenerate }: any) {
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [qtype, setQtype] = useState<"mcq" | "true_false" | "short" | "essay">("mcq");
  const [subject, setSubject] = useState("general");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-600" /> توليد أسئلة بالذكاء الاصطناعي
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>الموضوع أو المحتوى</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
              placeholder="مثال: مفاهيم الجغرافيا الطبيعية لمصر، الوحدة الأولى" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>عدد الأسئلة</Label>
              <Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div>
              <Label>الصعوبة</Label>
              <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">سهل</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="hard">صعب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>نوع السؤال</Label>
              <Select value={qtype} onValueChange={(v: any) => setQtype(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">اختيار من متعدد</SelectItem>
                  <SelectItem value="true_false">صح/خطأ</SelectItem>
                  <SelectItem value="short">قصير</SelectItem>
                  <SelectItem value="essay">مقالي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المادة</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            disabled={!prompt.trim() || loading}
            onClick={async () => {
              setLoading(true);
              try { await onGenerate({ prompt, count, difficulty, question_type: qtype, subject, save_to_bank: true }); }
              finally { setLoading(false); }
            }}
          >
            {loading ? "جارٍ التوليد…" : "توليد وحفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExamFromBankDialog({ open, onOpenChange, count, onCreate }: any) {
  const [title, setTitle] = useState("امتحان من بنك الأسئلة");
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء امتحان من {count} سؤال محدد</DialogTitle>
          <DialogDescriptionInline>سيتم إنشاء الامتحان كمسودة يمكن تعديلها بعد ذلك.</DialogDescriptionInline>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>عنوان الامتحان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>المدة (بالدقائق)</Label>
            <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button disabled={!title.trim() || loading} onClick={async () => {
            setLoading(true); try { await onCreate(title, duration); } finally { setLoading(false); }
          }}>{loading ? "جارٍ الإنشاء…" : "إنشاء الامتحان"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogDescriptionInline({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function BulkTargetsDialog({ open, onOpenChange, count, classes, groups, onApply }: any) {
  const [classIds, setClassIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useMemo(() => {
    if (open) { setClassIds([]); setGroupIds([]); }
  }, [open]);

  const availableGroups = classIds.length > 0
    ? (groups ?? []).filter((g: any) => classIds.includes(g.class_id))
    : (groups ?? []);
  const toggle = (arr: string[], id: string, setter: (v: string[]) => void) =>
    setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>استهداف {count} عنصر لصفوف / مجموعات</DialogTitle>
          <DialogDescriptionInline>اترك القائمة فارغة ليصل العنصر لجميع الصفوف/المجموعات.</DialogDescriptionInline>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">الصفوف</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(classes ?? []).map((c: any) => (
                <label key={c.id} className={`flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer ${classIds.includes(c.id) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                  <Checkbox checked={classIds.includes(c.id)} onCheckedChange={() => toggle(classIds, c.id, setClassIds)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">المجموعات</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {availableGroups.length === 0 && <span className="text-xs text-muted-foreground">لا توجد مجموعات</span>}
              {availableGroups.map((g: any) => (
                <label key={g.id} className={`flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer ${groupIds.includes(g.id) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                  <Checkbox checked={groupIds.includes(g.id)} onCheckedChange={() => toggle(groupIds, g.id, setGroupIds)} />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button disabled={loading} onClick={async () => {
            setLoading(true);
            try { await onApply(classIds, groupIds); } finally { setLoading(false); }
          }}>{loading ? "جارٍ التطبيق…" : "تطبيق"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

