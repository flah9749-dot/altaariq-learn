import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardList, CheckCircle2, XCircle, Loader2, MessageCircle, Copy, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listRegistrationRequests, approveRegistration, rejectRegistration, getRegistrationStats } from "@/lib/self-registration.functions";

export const Route = createFileRoute("/admin/registration-requests")({
  head: () => ({ meta: [{ title: "طلبات التسجيل — لوحة المدرس" }] }),
  component: RequestsPage,
});

function RequestsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRegistrationRequests);
  const statsFn = useServerFn(getRegistrationStats);
  const rejFn = useServerFn(rejectRegistration);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["reg-requests", tab],
    queryFn: () => listFn({ data: { status: tab === "approved" ? "approved" : tab } }),
  });
  const { data: stats } = useQuery({ queryKey: ["reg-stats"], queryFn: () => statsFn({}) });

  const [approveDlg, setApproveDlg] = useState<any | null>(null);
  const [rejectDlg, setRejectDlg] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const doReject = async () => {
    if (!rejectDlg) return;
    setRejecting(true);
    try {
      await rejFn({ data: { id: rejectDlg.id, reason: rejectReason.trim() || undefined } });
      qc.invalidateQueries({ queryKey: ["reg-requests"] });
      qc.invalidateQueries({ queryKey: ["reg-stats"] });
      toast.success("تم الرفض");
      setRejectDlg(null); setRejectReason("");
    } catch (e: any) { toast.error(e?.message ?? "فشل"); }
    finally { setRejecting(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-primary" /> طلبات التسجيل
        </h1>
        <p className="text-sm text-muted-foreground mt-1">راجع طلبات الطلاب واعتمدها أو ارفضها.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="اليوم" value={stats?.today ?? 0} />
        <Stat label="معلّق" value={stats?.pending ?? 0} tone="warning" />
        <Stat label="مقبول" value={stats?.approved ?? 0} tone="success" />
        <Stat label="مرفوض" value={stats?.rejected ?? 0} tone="destructive" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-4 w-full sm:w-auto">
          <TabsTrigger value="pending">المعلّقة</TabsTrigger>
          <TabsTrigger value="approved">المعتمدة</TabsTrigger>
          <TabsTrigger value="rejected">المرفوضة</TabsTrigger>
          <TabsTrigger value="all">الكل</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">الطلبات ({(rows ?? []).length})</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الصف/المجموعة</TableHead>
                    <TableHead>هاتف الطالب</TableHead>
                    <TableHead>هاتف ولي الأمر</TableHead>
                    <TableHead>الكود</TableHead>
                    <TableHead>الوقت</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-center">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8" /></TableCell></TableRow>
                  )) : (rows ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد طلبات.</TableCell></TableRow>
                  ) : (rows as any[]).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell className="text-xs">{r.classes?.name ?? "—"}<br />{r.groups?.name ?? "—"}</TableCell>
                      <TableCell dir="ltr" className="text-sm">{r.student_phone}</TableCell>
                      <TableCell dir="ltr" className="text-sm">{r.parent_phone}</TableCell>
                      <TableCell><code className="font-mono text-xs" dir="ltr">{r.join_codes?.code ?? "—"}</code></TableCell>
                      <TableCell className="text-xs"><Clock className="inline h-3 w-3 mr-1" />{new Date(r.created_at).toLocaleString("ar-EG")}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell>
                        {r.status === "pending" ? (
                          <div className="flex justify-center gap-1">
                            <Button size="sm" variant="default" className="gap-1" onClick={() => setApproveDlg(r)}>
                              <CheckCircle2 className="h-4 w-4" /> قبول
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-1" onClick={() => setRejectDlg(r)}>
                              <XCircle className="h-4 w-4" /> رفض
                            </Button>
                          </div>
                        ) : r.reject_reason ? (
                          <span className="text-xs text-muted-foreground">{r.reject_reason}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {approveDlg && <ApproveDialog req={approveDlg} onClose={() => setApproveDlg(null)} />}

      {rejectDlg && (
        <Dialog open onOpenChange={(v) => !v && setRejectDlg(null)}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>رفض الطلب</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>سبب الرفض (اختياري)</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDlg(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={doReject} disabled={rejecting} className="gap-2">
                {rejecting && <Loader2 className="h-4 w-4 animate-spin" />} تأكيد الرفض
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warning" | "success" | "destructive" }) {
  const cls = tone === "warning" ? "text-amber-500" : tone === "success" ? "text-emerald-500" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") return <Badge variant="outline" className="border-amber-500 text-amber-600">معلّق</Badge>;
  if (status === "approved" || status === "auto_approved") return <Badge className="bg-emerald-500">{status === "auto_approved" ? "قبول تلقائي" : "مقبول"}</Badge>;
  return <Badge variant="destructive">مرفوض</Badge>;
}

function ApproveDialog({ req, onClose }: { req: any; onClose: () => void }) {
  const qc = useQueryClient();
  const apprFn = useServerFn(approveRegistration);
  const [name, setName] = useState(req.full_name);
  const [sPhone, setSPhone] = useState(req.student_phone);
  const [pPhone, setPPhone] = useState(req.parent_phone);
  const [pName, setPName] = useState(req.parent_name ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async () => {
    setLoading(true);
    try {
      const r: any = await apprFn({ data: { id: req.id, overrides: { full_name: name, student_phone: sPhone, parent_phone: pPhone, parent_name: pName || null } } });
      qc.invalidateQueries({ queryKey: ["reg-requests"] });
      qc.invalidateQueries({ queryKey: ["reg-stats"] });
      setResult(r);
      toast.success("تم اعتماد الطلب");
    } catch (e: any) { toast.error(e?.message ?? "فشل الاعتماد"); }
    finally { setLoading(false); }
  };

  const copy = (v: string, l: string) => { navigator.clipboard.writeText(v); toast.success(`تم نسخ ${l}`); };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>{result ? "تم الاعتماد" : "اعتماد الطلب"}</DialogTitle></DialogHeader>
        {!result ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">راجع البيانات قبل الاعتماد. يمكنك تعديلها.</p>
            <div className="space-y-2"><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>هاتف الطالب</Label><Input value={sPhone} onChange={(e) => setSPhone(e.target.value)} dir="ltr" /></div>
              <div className="space-y-2"><Label>هاتف ولي الأمر</Label><Input value={pPhone} onChange={(e) => setPPhone(e.target.value)} dir="ltr" /></div>
            </div>
            <div className="space-y-2"><Label>اسم ولي الأمر</Label><Input value={pName} onChange={(e) => setPName(e.target.value)} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>إلغاء</Button>
              <Button onClick={submit} disabled={loading} className="gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} إنشاء الحساب
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
              <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">كود الطالب</span>
                <div className="flex items-center gap-2"><code className="font-mono font-bold" dir="ltr">{result.credentials.code}</code>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(result.credentials.code, "الكود")}><Copy className="h-3.5 w-3.5" /></Button></div>
              </div>
              <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">كلمة المرور</span>
                <div className="flex items-center gap-2"><code className="font-mono font-bold" dir="ltr">{result.credentials.password}</code>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(result.credentials.password, "كلمة المرور")}><Copy className="h-3.5 w-3.5" /></Button></div>
              </div>
            </div>
            {result.whatsapp?.parent && (
              <Button asChild variant="outline" className="w-full gap-2">
                <a href={result.whatsapp.parent} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" /> إرسال البيانات لولي الأمر عبر واتساب
                </a>
              </Button>
            )}
            <DialogFooter><Button onClick={onClose}>إغلاق</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
