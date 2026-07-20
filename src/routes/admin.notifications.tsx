import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Loader2, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { broadcastNotification, upsertAnnouncement, deleteAnnouncement } from "@/lib/announcements.functions";
import { relativeTime } from "@/lib/message-utils";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "الإشعارات — لوحة المدرس" }] }),
  component: AdminNotificationsPage,
});

function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6 text-primary"/>الإشعارات والإعلانات</h1>
        <p className="text-muted-foreground text-sm mt-1">أرسل إشعارات فورية وأنشئ إعلانات موجهة للطلاب</p>
      </div>
      <Tabs defaultValue="notif" dir="rtl">
        <TabsList>
          <TabsTrigger value="notif">إشعار سريع</TabsTrigger>
          <TabsTrigger value="ann">الإعلانات</TabsTrigger>
        </TabsList>
        <TabsContent value="notif" className="mt-4"><QuickNotification/></TabsContent>
        <TabsContent value="ann" className="mt-4"><AnnouncementsManager/></TabsContent>
      </Tabs>
    </div>
  );
}

function QuickNotification() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all"|"class"|"group">("all");
  const [classId, setClassId] = useState<string|undefined>();
  const [groupId, setGroupId] = useState<string|undefined>();
  const fn = useServerFn(broadcastNotification);

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () =>
    (await supabase.from("classes").select("id,name").order("name")).data ?? [] });
  const { data: groups } = useQuery({ queryKey: ["groups"], queryFn: async () =>
    (await supabase.from("groups").select("id,name").order("name")).data ?? [] });

  const send = useMutation({
    mutationFn: async () => fn({ data: { title, body, target, class_id: classId ?? null, group_id: groupId ?? null, student_ids: [], type: "admin" } }),
    onSuccess: (r: any) => { toast.success(`تم إرسال الإشعار إلى ${r.count} طالب`); setTitle(""); setBody(""); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  return (
    <Card>
      <CardHeader><CardTitle>إشعار جديد</CardTitle><CardDescription>يظهر فورًا لدى الطلاب المستهدفين</CardDescription></CardHeader>
      <CardContent className="space-y-3 max-w-2xl">
        <div><Label>العنوان</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإشعار"/></div>
        <div><Label>الرسالة</Label><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>الفئة</Label>
            <Select value={target} onValueChange={(v: any) => setTarget(v)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الجميع</SelectItem>
                <SelectItem value="class">فصل</SelectItem>
                <SelectItem value="group">مجموعة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {target === "class" && (
            <div><Label>الفصل</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="اختر"/></SelectTrigger>
                <SelectContent>{(classes??[]).map((c:any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {target === "group" && (
            <div><Label>المجموعة</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="اختر"/></SelectTrigger>
                <SelectContent>{(groups??[]).map((g:any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button onClick={() => send.mutate()} disabled={!title.trim() || !body.trim() || send.isPending}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1"/> : <Send className="h-4 w-4 ml-1"/>}
          إرسال الإشعار
        </Button>
      </CardContent>
    </Card>
  );
}

function AnnouncementsManager() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ id: undefined as string|undefined, title: "", body: "", priority: "normal" as "low"|"normal"|"high", ends_at: "" });
  const upFn = useServerFn(upsertAnnouncement);
  const delFn = useServerFn(deleteAnnouncement);

  const { data: list, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => upFn({ data: {
      id: form.id, title: form.title, body: form.body, priority: form.priority,
      ends_at: form.ends_at || null, target_all: true, target_class_ids: [], target_group_ids: [], target_student_ids: [],
      starts_at: new Date().toISOString(), published: true,
    } }),
    onSuccess: () => { toast.success("تم الحفظ"); setForm({ id: undefined, title: "", body: "", priority: "normal", ends_at: "" }); qc.invalidateQueries({ queryKey: ["announcements"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["announcements"] }); },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{form.id ? "تعديل الإعلان" : "إعلان جديد"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>العنوان</Label><Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})}/></div>
          <div><Label>المحتوى</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({...form, body: e.target.value})}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>الأهمية</Label>
              <Select value={form.priority} onValueChange={(v: any) => setForm({...form, priority: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>تاريخ الانتهاء</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({...form, ends_at: e.target.value})}/></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={!form.title.trim() || !form.body.trim() || save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1"/> : null}حفظ
            </Button>
            {form.id && <Button variant="ghost" onClick={() => setForm({ id: undefined, title: "", body: "", priority: "normal", ends_at: "" })}>إلغاء</Button>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>الإعلانات المنشورة</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
          {isLoading ? <><Skeleton className="h-16"/><Skeleton className="h-16"/></>
            : (list ?? []).length === 0 ? <p className="text-sm text-muted-foreground">لا توجد إعلانات</p>
            : (list ?? []).map((a: any) => (
              <div key={a.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{a.title}</p>
                      {a.priority === "high" && <Badge variant="destructive">عاجل</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{relativeTime(a.created_at)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setForm({ id: a.id, title: a.title, body: a.body, priority: a.priority, ends_at: a.ends_at?.slice(0,16) ?? "" })}>تعديل</Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
