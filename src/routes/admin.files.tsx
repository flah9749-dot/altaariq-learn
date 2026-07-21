import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FolderOpen, Loader2, Search, Trash2, Upload, Users, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { upsertFile, deleteFile, getFileUrl } from "@/lib/announcements.functions";
import { fileIconFor, humanSize, formatChatDetailedTime } from "@/lib/message-utils";

export const Route = createFileRoute("/admin/files")({
  head: () => ({ meta: [{ title: "الملفات — لوحة المدرس" }] }),
  component: AdminFilesPage,
});

// Sanitize filename for Supabase storage key (ASCII only, safe chars).
function sanitizeStorageName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  const safeBase = base
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")   // collapse illegal chars
    .replace(/[^\x20-\x7E]+/g, "")          // strip non-ASCII (Arabic etc.)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return (safeBase || "file") + ext;
}

function AdminFilesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<File[] | null>(null);
  const [targetClass, setTargetClass] = useState<string>("all");
  const [targetGroup, setTargetGroup] = useState<string>("all");

  const upFn = useServerFn(upsertFile);
  const delFn = useServerFn(deleteFile);
  const urlFn = useServerFn(getFileUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["files-list"],
    queryFn: async () => (await supabase.from("files").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-basic"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups-basic"],
    queryFn: async () => (await supabase.from("groups").select("id,name,class_id").order("name")).data ?? [],
  });
  const filteredGroups = useMemo(
    () => (targetClass === "all" ? groups : groups.filter((g: any) => g.class_id === targetClass)),
    [groups, targetClass],
  );

  const classNameOf = (id: string | null) => classes.find((c: any) => c.id === id)?.name;
  const groupNameOf = (id: string | null) => groups.find((g: any) => g.id === id)?.name;

  const del = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["files-list"] }); },
  });

  const onPickFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    setPending(Array.from(files));
    setTargetClass("all");
    setTargetGroup("all");
  };

  const confirmUpload = async () => {
    if (!pending || !user) return;
    setUploading(true);
    try {
      for (const file of pending) {
        const safeName = sanitizeStorageName(file.name);
        const key = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from("general").upload(key, file, { contentType: file.type, cacheControl: "3600" });
        if (error) throw new Error(error.message);
        await upFn({ data: {
          name: file.name, description: null, category: "general", bucket: "general",
          path: key, mime_type: file.type, size: file.size, is_public: true,
          target_class_id: targetClass === "all" ? null : targetClass,
          target_group_id: targetGroup === "all" ? null : targetGroup,
        } });
      }
      toast.success("تم رفع الملفات");
      qc.invalidateQueries({ queryKey: ["files-list"] });
      setPending(null);
    } catch (e: any) { toast.error(e?.message ?? "فشل الرفع"); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const download = async (id: string) => {
    try {
      const r: any = await urlFn({ data: { id } });
      window.open(r.url, "_blank", "noopener");
      qc.invalidateQueries({ queryKey: ["files-list"] });
    } catch (e: any) { toast.error(e?.message ?? "تعذر التنزيل"); }
  };

  const filtered = (data ?? []).filter((f: any) => !q || f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FolderOpen className="h-6 w-6 text-primary"/>مركز الملفات</h1>
          <p className="text-muted-foreground text-sm mt-1">مكتبة الموارد التعليمية للطلاب</p>
        </div>
        <div className="flex gap-2">
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin ml-1"/> : <Upload className="h-4 w-4 ml-1"/>}
            رفع ملفات
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>الملفات ({filtered.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="pr-8 h-9"/>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-12"/>)}</div>
            : filtered.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">لا توجد ملفات</p>
            : <Table>
                <TableHeader><TableRow>
                  <TableHead>الاسم</TableHead><TableHead>الاستهداف</TableHead>
                  <TableHead>الحجم</TableHead>
                  <TableHead>التحميلات</TableHead><TableHead>التاريخ</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((f: any) => {
                    const Icon = fileIconFor(f.mime_type);
                    const cls = classNameOf(f.target_class_id);
                    const grp = groupNameOf(f.target_group_id);
                    return (
                      <TableRow key={f.id}>
                        <TableCell><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary shrink-0"/><span className="font-medium truncate max-w-[300px]">{f.name}</span></div></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {!cls && !grp && <Badge variant="outline">للجميع</Badge>}
                            {cls && <Badge variant="secondary" className="gap-1"><GraduationCap className="h-3 w-3"/>{cls}</Badge>}
                            {grp && <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3"/>{grp}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{humanSize(f.size)}</TableCell>
                        <TableCell><Badge variant="secondary">{f.download_count ?? 0}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatChatDetailedTime(f.created_at)}</TableCell>
                        <TableCell className="text-left">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => download(f.id)}><Download className="h-4 w-4"/></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(f.id)}><Trash2 className="h-4 w-4"/></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>}
        </CardContent>
      </Card>

      <Dialog open={!!pending} onOpenChange={(o) => !o && !uploading && setPending(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>توجيه الملفات</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {pending?.length ?? 0} ملف — اختر الفئة المستهدفة (اتركها "الجميع" ليظهر لكل الطلاب).
            </p>
            <div className="space-y-2">
              <Label>الصف الدراسي</Label>
              <Select value={targetClass} onValueChange={(v) => { setTargetClass(v); setTargetGroup("all"); }}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الصفوف</SelectItem>
                  {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المجموعة</Label>
              <Select value={targetGroup} onValueChange={setTargetGroup} disabled={targetClass === "all" && groups.length > 0 ? false : filteredGroups.length === 0}>
                <SelectTrigger><SelectValue placeholder="جميع المجموعات"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المجموعات</SelectItem>
                  {filteredGroups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-auto border rounded-md p-2">
              {pending?.map((f, i) => <li key={i}>• {f.name} <span className="opacity-60">({humanSize(f.size)})</span></li>)}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={uploading}>إلغاء</Button>
            <Button onClick={confirmUpload} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin ml-1"/> : <Upload className="h-4 w-4 ml-1"/>}
              رفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
