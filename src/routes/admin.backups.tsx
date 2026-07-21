import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Download, Trash2, Plus, Loader2, HardDrive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { listBackups, createBackup, getBackupDownloadUrl, deleteBackup } from "@/lib/backups.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/backups")({ component: BackupsPage });

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function BackupsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBackups);
  const createFn = useServerFn(createBackup);
  const urlFn = useServerFn(getBackupDownloadUrl);
  const delFn = useServerFn(deleteBackup);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => listFn(),
  });

  const createM = useMutation({
    mutationFn: () => createFn({ data: { kind: "manual" } }),
    onSuccess: () => { toast.success("تم إنشاء النسخة الاحتياطية"); qc.invalidateQueries({ queryKey: ["backups"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإنشاء"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["backups"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  async function download(id: string) {
    try {
      const { url } = await urlFn({ data: { id } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل التنزيل");
    }
  }

  const totalSize = rows.reduce((s: number, r: any) => s + (r.size_bytes ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6"/> النسخ الاحتياطي</h1>
          <p className="text-sm text-muted-foreground">إنشاء واستعادة نسخ من بيانات المنصة</p>
        </div>
        <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
          {createM.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin"/> : <Plus className="h-4 w-4 ml-2"/>}
          إنشاء نسخة الآن
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">عدد النسخ</p>
          <p className="text-3xl font-bold tabular-nums mt-1">{rows.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">الحجم الكلي</p>
          <p className="text-3xl font-bold tabular-nums mt-1">{formatSize(totalSize)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-3">
          <HardDrive className="h-8 w-8 text-primary"/>
          <div>
            <p className="text-sm text-muted-foreground">التخزين</p>
            <p className="font-semibold">Supabase Storage — bucket: backups</p>
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">الحجم</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">جاري التحميل...</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد نسخ احتياطية بعد.</TableCell></TableRow>
              )}
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="secondary">{r.kind}</Badge></TableCell>
                  <TableCell className="tabular-nums">{formatSize(r.size_bytes)}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</TableCell>
                  <TableCell><Badge className="bg-success/15 text-success hover:bg-success/20">{r.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => download(r.id)} title="تنزيل">
                        <Download className="h-4 w-4"/>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive" title="حذف">
                            <Trash2 className="h-4 w-4"/>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف النسخة الاحتياطية؟</AlertDialogTitle>
                            <AlertDialogDescription>لا يمكن التراجع عن هذا الإجراء. سيتم حذف الملف من التخزين.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => delM.mutate(r.id)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
