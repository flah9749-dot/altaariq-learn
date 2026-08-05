import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Video, Plus, Trash2, Pencil, BarChart3, Paperclip, Lock, Upload, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  upsertVideo, deleteVideo, getVideoStats, grantVideoAccess, addVideoAttachment,
} from "@/lib/videos.functions";

export const Route = createFileRoute("/admin/videos")({
  head: () => ({
    meta: [
      { title: "الفيديوهات التعليمية — لوحة المدرس" },
      { name: "description", content: "رفع وإدارة الفيديوهات التعليمية وصلاحيات المشاهدة وإحصائيات الطلاب." },
      { property: "og:title", content: "الفيديوهات التعليمية — لوحة المدرس" },
      { property: "og:description", content: "رفع وإدارة الفيديوهات التعليمية وصلاحيات المشاهدة وإحصائيات الطلاب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminVideosPage,
});

const ACCESS_LABEL: Record<string, { label: string; cls: string }> = {
  free: { label: "مجاني", cls: "bg-accent/15 text-accent" },
  paid: { label: "مدفوع", cls: "bg-gold/25 text-gold-foreground" },
  hidden: { label: "مخفي", cls: "bg-muted text-muted-foreground" },
  scheduled: { label: "مجدول", cls: "bg-warning/25 text-warning-foreground" },
};

type FormState = {
  id?: string;
  title: string; description: string;
  class_id: string; group_id: string;
  term: string; unit: string; lesson: string;
  provider: "upload" | "youtube" | "bunny" | "cloudflare" | "url";
  source_url: string; storage_path: string; thumbnail_url: string;
  duration_sec: number;
  access_type: "free" | "paid" | "hidden" | "scheduled";
  publish_at: string; access_expires_at: string;
  notify: boolean;
};

const empty: FormState = {
  title: "", description: "", class_id: "", group_id: "", term: "", unit: "", lesson: "",
  provider: "youtube", source_url: "", storage_path: "", thumbnail_url: "", duration_sec: 0,
  access_type: "free", publish_at: "", access_expires_at: "", notify: true,
};

function AdminVideosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [uploading, setUploading] = useState(false);
  const [statsFor, setStatsFor] = useState<string | null>(null);
  const [grantFor, setGrantFor] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  const saveFn = useServerFn(upsertVideo);
  const delFn = useServerFn(deleteVideo);
  const statsFn = useServerFn(getVideoStats);
  const grantFn = useServerFn(grantVideoAccess);
  const attachFn = useServerFn(addVideoAttachment);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups-min"],
    queryFn: async () => (await supabase.from("groups").select("id,name,class_id").order("name")).data ?? [],
  });
  const { data: videos, isLoading } = useQuery({
    queryKey: ["admin-videos"],
    queryFn: async () =>
      (await supabase.from("videos").select("*, classes(name), groups(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: stats } = useQuery({
    queryKey: ["video-stats", statsFor],
    enabled: !!statsFor,
    queryFn: async () => (await statsFn({ data: { id: statsFor! } })) as any,
  });

  const filtered = useMemo(
    () => (videos ?? []).filter((v: any) => !search || v.title?.includes(search)),
    [videos, search],
  );
  const groupOptions = groups.filter((g: any) => !form.class_id || g.class_id === form.class_id);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const uploadVideoFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const path = `lessons/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("videos").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      set({ storage_path: path, provider: "upload" });
      toast.success("تم رفع الفيديو");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر رفع الفيديو");
    } finally {
      setUploading(false);
    }
  };

  const uploadAttachment = async (videoId: string, file: File) => {
    try {
      const path = `attachments/${videoId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("videos").upload(path, file, { contentType: file.type });
      if (error) throw error;
      await attachFn({ data: { video_id: videoId, name: file.name, url: path, kind: "file", size: file.size } });
      toast.success("تمت إضافة المرفق");
      qc.invalidateQueries({ queryKey: ["admin-videos"] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر رفع المرفق");
    }
  };

  const save = async () => {
    try {
      if (form.provider === "upload" && !form.storage_path) return toast.error("ارفع ملف الفيديو أولاً");
      if (form.provider !== "upload" && !form.source_url) return toast.error("أدخل رابط الفيديو");
      await saveFn({
        data: {
          id: form.id,
          title: form.title,
          description: form.description || null,
          class_id: form.class_id || null,
          group_id: form.group_id || null,
          term: form.term || null,
          unit: form.unit || null,
          lesson: form.lesson || null,
          provider: form.provider,
          source_url: form.source_url || null,
          storage_path: form.storage_path || null,
          thumbnail_url: form.thumbnail_url || null,
          duration_sec: Number(form.duration_sec) || 0,
          access_type: form.access_type,
          publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : null,
          access_expires_at: form.access_expires_at ? new Date(form.access_expires_at).toISOString() : null,
          notify: form.notify && !form.id,
        },
      });
      toast.success(form.id ? "تم تحديث الفيديو" : "تم نشر الفيديو");
      setOpen(false); setForm(empty);
      qc.invalidateQueries({ queryKey: ["admin-videos"] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف الفيديو نهائياً؟")) return;
    try {
      await delFn({ data: { id } });
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["admin-videos"] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحذف");
    }
  };

  const editRow = (v: any) => {
    setForm({
      id: v.id, title: v.title, description: v.description ?? "",
      class_id: v.class_id ?? "", group_id: v.group_id ?? "",
      term: v.term ?? "", unit: v.unit ?? "", lesson: v.lesson ?? "",
      provider: v.provider, source_url: v.source_url ?? "", storage_path: v.storage_path ?? "",
      thumbnail_url: v.thumbnail_url ?? "", duration_sec: v.duration_sec ?? 0,
      access_type: v.access_type,
      publish_at: v.publish_at ? v.publish_at.slice(0, 16) : "",
      access_expires_at: v.access_expires_at ? v.access_expires_at.slice(0, 16) : "",
      notify: false,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Video className="h-6 w-6 text-primary" />الفيديوهات التعليمية</h1>
          <p className="mt-1 text-sm text-muted-foreground">ارفع الدروس المصوّرة وتحكم في صلاحيات المشاهدة وتابع الطلاب</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-2 h-4 w-4" />فيديو جديد</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" dir="rtl">
            <DialogHeader><DialogTitle>{form.id ? "تعديل فيديو" : "إضافة فيديو"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>عنوان الفيديو</Label>
                <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثال: الدرس الأول - الموقع الفلكي" />
              </div>
              <div className="sm:col-span-2">
                <Label>وصف مختصر</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
              </div>

              <div>
                <Label>الصف الدراسي</Label>
                <Select value={form.class_id || "all"} onValueChange={(v) => set({ class_id: v === "all" ? "" : v, group_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="كل الصفوف" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الصفوف</SelectItem>
                    {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المجموعة (اختياري)</Label>
                <Select value={form.group_id || "all"} onValueChange={(v) => set({ group_id: v === "all" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="كل المجموعات" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المجموعات</SelectItem>
                    {groupOptions.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div><Label>الفصل الدراسي</Label><Input value={form.term} onChange={(e) => set({ term: e.target.value })} placeholder="الفصل الأول" /></div>
              <div><Label>الوحدة</Label><Input value={form.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="الوحدة الأولى" /></div>
              <div><Label>الدرس</Label><Input value={form.lesson} onChange={(e) => set({ lesson: e.target.value })} placeholder="الدرس الثاني" /></div>
              <div><Label>مدة الفيديو (بالثواني)</Label><Input type="number" value={form.duration_sec} onChange={(e) => set({ duration_sec: Number(e.target.value) })} /></div>

              <div>
                <Label>المصدر</Label>
                <Select value={form.provider} onValueChange={(v: any) => set({ provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upload">رفع من الجهاز</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="bunny">Bunny Stream</SelectItem>
                    <SelectItem value="cloudflare">Cloudflare Stream</SelectItem>
                    <SelectItem value="url">رابط مباشر (MP4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.provider === "upload" ? (
                <div>
                  <Label>ملف الفيديو</Label>
                  <Input type="file" accept="video/*" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideoFile(f); }} />
                  {uploading && <p className="mt-1 text-xs text-muted-foreground">جارٍ الرفع…</p>}
                  {form.storage_path && <p className="mt-1 text-xs text-accent">تم الرفع ✓</p>}
                </div>
              ) : (
                <div>
                  <Label>رابط الفيديو</Label>
                  <Input value={form.source_url} onChange={(e) => set({ source_url: e.target.value })} placeholder="https://…" dir="ltr" />
                </div>
              )}

              <div className="sm:col-span-2"><Label>صورة مصغرة (رابط)</Label><Input value={form.thumbnail_url} onChange={(e) => set({ thumbnail_url: e.target.value })} dir="ltr" /></div>

              <div>
                <Label>حالة الإتاحة</Label>
                <Select value={form.access_type} onValueChange={(v: any) => set({ access_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">مجاني</SelectItem>
                    <SelectItem value="paid">مدفوع (بصلاحية)</SelectItem>
                    <SelectItem value="hidden">مخفي (مسودة)</SelectItem>
                    <SelectItem value="scheduled">مجدول</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.access_type === "scheduled" && (
                <div><Label>موعد النشر</Label><Input type="datetime-local" value={form.publish_at} onChange={(e) => set({ publish_at: e.target.value })} /></div>
              )}
              <div className="sm:col-span-2">
                <Label>انتهاء صلاحية المشاهدة (اختياري)</Label>
                <Input type="datetime-local" value={form.access_expires_at} onChange={(e) => set({ access_expires_at: e.target.value })} />
              </div>

              {!form.id && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={form.notify} onChange={(e) => set({ notify: e.target.checked })} />
                  إرسال إشعار للطلاب المستهدفين بعد النشر
                </label>
              )}
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={uploading || !form.title}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="بحث بالعنوان…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد فيديوهات بعد</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v: any) => {
            const a = ACCESS_LABEL[v.access_type] ?? ACCESS_LABEL.free;
            return (
              <Card key={v.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-6">{v.title}</CardTitle>
                    <Badge className={a.cls}>{a.label}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {[v.classes?.name, v.groups?.name, v.term, v.unit, v.lesson].filter(Boolean).join(" • ") || "لكل الطلاب"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
                  <p className="text-xs text-muted-foreground">المشاهدات: {v.views_count ?? 0}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => editRow(v)}><Pencil className="ml-1 h-3.5 w-3.5" />تعديل</Button>
                    <Button size="sm" variant="outline" onClick={() => setStatsFor(v.id)}><BarChart3 className="ml-1 h-3.5 w-3.5" />إحصائيات</Button>
                    <Button size="sm" variant="outline" onClick={() => setGrantFor(v)}><KeyRound className="ml-1 h-3.5 w-3.5" />صلاحيات</Button>
                    <label className="inline-flex cursor-pointer items-center rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
                      <Paperclip className="ml-1 h-3.5 w-3.5" />مرفق
                      <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(v.id, f); }} />
                    </label>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stats dialog */}
      <Dialog open={!!statsFor} onOpenChange={(o) => !o && setStatsFor(null)}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>إحصائيات المشاهدة</DialogTitle></DialogHeader>
          {!stats ? <Skeleton className="h-32" /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox label="المشاهدات" value={stats.views} />
                <StatBox label="عدد المشاهدين" value={stats.watchers} />
                <StatBox label="أكملوا الفيديو" value={stats.completed} />
                <StatBox label="متوسط المشاهدة" value={`${stats.avgPercent}%`} />
              </div>
              <div className="space-y-2">
                {stats.students.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مشاهدات بعد</p> :
                  stats.students.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <span>{s.students?.full_name ?? "طالب"} <span className="text-xs text-muted-foreground">({s.students?.code})</span></span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{s.percent}%</span>
                        <span>{s.completed ? "مكتمل" : "غير مكتمل"}</span>
                        <span>{s.last_watched_at ? new Date(s.last_watched_at).toLocaleString("ar-EG") : ""}</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grant dialog */}
      <GrantDialog
        video={grantFor}
        classes={classes}
        groups={groups}
        onClose={() => setGrantFor(null)}
        onGrant={async (payload) => {
          try {
            await grantFn({ data: payload as any });
            toast.success("تم منح الصلاحية");
            setGrantFor(null);
          } catch (e: any) { toast.error(e?.message ?? "تعذر منح الصلاحية"); }
        }}
      />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-extrabold">{value}</p>
    </div>
  );
}

function GrantDialog({ video, classes, groups, onClose, onGrant }: {
  video: any; classes: any[]; groups: any[];
  onClose: () => void; onGrant: (p: any) => void;
}) {
  const [scope, setScope] = useState<"student" | "group" | "class" | "all">("class");
  const [classId, setClassId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [expires, setExpires] = useState("");

  const submit = async () => {
    let student_id: string | null = null;
    if (scope === "student") {
      const { data } = await supabase.from("students").select("id").eq("code", studentCode.trim()).maybeSingle();
      if (!data?.id) return toast.error("لم يتم العثور على طالب بهذا الكود");
      student_id = data.id;
    }
    onGrant({
      video_id: video.id, scope,
      student_id, class_id: scope === "class" ? classId || null : null,
      group_id: scope === "group" ? groupId || null : null,
      expires_at: expires ? new Date(expires).toISOString() : null,
    });
  };

  return (
    <Dialog open={!!video} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />منح صلاحية مشاهدة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>نطاق الصلاحية</Label>
            <Select value={scope} onValueChange={(v: any) => setScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">طالب واحد</SelectItem>
                <SelectItem value="group">مجموعة</SelectItem>
                <SelectItem value="class">صف دراسي</SelectItem>
                <SelectItem value="all">جميع الطلاب</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "student" && <div><Label>كود الطالب</Label><Input value={studentCode} onChange={(e) => setStudentCode(e.target.value)} /></div>}
          {scope === "class" && (
            <div><Label>الصف</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {scope === "group" && (
            <div><Label>المجموعة</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="اختر المجموعة" /></SelectTrigger>
                <SelectContent>{groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>تنتهي في (اختياري)</Label><Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit}><Upload className="ml-2 h-4 w-4" />منح الصلاحية</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
