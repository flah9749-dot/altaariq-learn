import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Key, Plus, Copy, Trash2, Ban, Loader2, Code2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { listApiTokens, createApiToken, revokeApiToken, deleteApiToken } from "@/lib/api-tokens.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/api")({ component: ApiPage });

function ApiPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listApiTokens);
  const createFn = useServerFn(createApiToken);
  const revokeFn = useServerFn(revokeApiToken);
  const delFn = useServerFn(deleteApiToken);

  const { data: tokens = [], isLoading } = useQuery({ queryKey: ["api-tokens"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [newToken, setNewToken] = useState<string | null>(null);

  const createM = useMutation({
    mutationFn: () => createFn({ data: { name, expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined } }),
    onSuccess: (res) => {
      setNewToken(res.token);
      setName("");
      setExpiresInDays("");
      qc.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإنشاء"),
  });
  const revokeM = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => { toast.success("تم إبطال المفتاح"); qc.invalidateQueries({ queryKey: ["api-tokens"] }); },
  });
  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["api-tokens"] }); },
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Key className="h-6 w-6"/> مفاتيح API</h1>
          <p className="text-sm text-muted-foreground">أنشئ مفاتيح للتطبيقات الخارجية للوصول إلى بيانات المنصة</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNewToken(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-2"/> مفتاح جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{newToken ? "تم إنشاء المفتاح" : "مفتاح API جديد"}</DialogTitle></DialogHeader>
            {newToken ? (
              <div className="space-y-3">
                <p className="text-sm text-warning-foreground bg-warning/15 rounded p-3">⚠️ انسخ هذا المفتاح الآن — لن يظهر مرة أخرى.</p>
                <div className="flex items-center gap-2">
                  <Input value={newToken} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()}/>
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(newToken); toast.success("تم النسخ"); }}>
                    <Copy className="h-4 w-4"/>
                  </Button>
                </div>
                <DialogFooter><Button onClick={() => { setOpen(false); setNewToken(null); }}>تم</Button></DialogFooter>
              </div>
            ) : (
              <div className="space-y-3">
                <div><Label>اسم المفتاح</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تطبيق الجوال"/></div>
                <div><Label>ينتهي بعد (أيام) — اختياري</Label><Input type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} placeholder="اتركه فارغاً للاستخدام الدائم"/></div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                  <Button onClick={() => createM.mutate()} disabled={!name || createM.isPending}>
                    {createM.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin"/>} إنشاء
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">البادئة</TableHead>
                <TableHead className="text-right">آخر استخدام</TableHead>
                <TableHead className="text-right">انتهاء الصلاحية</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>}
              {!isLoading && tokens.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد مفاتيح بعد.</TableCell></TableRow>}
              {tokens.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs">{t.prefix}…</TableCell>
                  <TableCell className="text-muted-foreground">{t.last_used_at ? new Date(t.last_used_at).toLocaleString("ar-EG") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.expires_at ? new Date(t.expires_at).toLocaleDateString("ar-EG") : "دائم"}</TableCell>
                  <TableCell>
                    {t.revoked_at ? <Badge variant="destructive">مُبطل</Badge> :
                     (t.expires_at && new Date(t.expires_at) < new Date()) ? <Badge variant="secondary">منتهي</Badge> :
                     <Badge className="bg-success/15 text-success hover:bg-success/20">نشط</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!t.revoked_at && (
                        <Button size="icon" variant="ghost" onClick={() => revokeM.mutate(t.id)} title="إبطال">
                          <Ban className="h-4 w-4"/>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => delM.mutate(t.id)} title="حذف">
                        <Trash2 className="h-4 w-4"/>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Code2 className="h-5 w-5"/> نقاط النهاية المتاحة</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">أضف الترويسة: <code className="bg-muted rounded px-2 py-1 font-mono">Authorization: Bearer &lt;TOKEN&gt;</code></p>
          <div className="space-y-2">
            {[
              { m: "GET", p: "/api/public/v1/stats", d: "إحصائيات عامة" },
              { m: "GET", p: "/api/public/v1/students?limit=50&grade=1", d: "قائمة الطلاب" },
              { m: "GET", p: "/api/public/v1/leaderboard?limit=20", d: "ترتيب الطلاب حسب النقاط" },
            ].map((e) => (
              <div key={e.p} className="flex items-center gap-3 p-2 rounded border">
                <Badge className="bg-primary text-primary-foreground">{e.m}</Badge>
                <code className="font-mono text-xs flex-1 truncate">{baseUrl}{e.p}</code>
                <span className="text-muted-foreground text-xs">{e.d}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
