import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Download, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToExcel } from "@/lib/reports";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({ meta: [{ title: "سجل النشاط — لوحة المدرس" }] }),
  component: ActivityPage,
});

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  student_create: "إضافة طالب",
  student_update: "تعديل طالب",
  student_delete: "حذف طالب",
  exam_create: "إنشاء امتحان",
  exam_update: "تعديل امتحان",
  exam_delete: "حذف امتحان",
  exam_publish: "نشر امتحان",
  attempt_approve: "اعتماد نتيجة",
  points_grant: "منح نقاط",
  reward_redeem: "استبدال جائزة",
  message_send: "إرسال رسالة",
  announcement_send: "إرسال إعلان",
  ai_use: "استخدام الذكاء الاصطناعي",
  settings_update: "تعديل الإعدادات",
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
};

function labelFor(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function ActivityPage() {
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["activity-log", actionFilter, page],
    queryFn: async () => {
      let query = supabase.from("activity_log")
        .select("id,actor_id,action,entity_type,entity_id,meta,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);
      const { data, count } = await query;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter((r: any) =>
      r.action?.toLowerCase().includes(s) ||
      r.entity_type?.toLowerCase().includes(s) ||
      JSON.stringify(r.meta ?? {}).toLowerCase().includes(s),
    );
  }, [data, q]);

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  const doExport = () => {
    const rows = filtered.map((r: any) => ({
      "التاريخ": new Date(r.created_at).toLocaleString("ar-EG"),
      "العملية": labelFor(r.action),
      "النوع": r.entity_type ?? "—",
      "المعرّف": r.entity_id ?? "—",
      "التفاصيل": JSON.stringify(r.meta ?? {}),
    }));
    exportToExcel(rows, `activity-log-${new Date().toISOString().slice(0, 10)}.xlsx`, "Activity");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />سجل النشاط
          </h1>
          <p className="text-sm text-muted-foreground mt-1">جميع العمليات المهمة داخل المنصة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-1 ${isFetching ? "animate-spin" : ""}`}/>تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={doExport}>
            <Download className="h-4 w-4 ml-1"/>تصدير Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>العمليات ({data?.count ?? 0})</CardTitle>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative w-56">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="pr-8 h-9"/>
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل العمليات</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? <div className="p-4 space-y-2">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-10"/>)}</div>
            : filtered.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">لا توجد عمليات مسجلة</p>
            : <Table>
                <TableHeader><TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>العملية</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التفاصيل</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("ar-EG")}</TableCell>
                      <TableCell><Badge variant="outline">{labelFor(r.action)}</Badge></TableCell>
                      <TableCell className="text-xs">{r.entity_type ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {r.meta ? JSON.stringify(r.meta).slice(0, 120) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>}
        </CardContent>
      </Card>

      {data && data.count > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">صفحة {page + 1} من {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>السابق</Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
          </div>
        </div>
      )}
    </div>
  );
}
