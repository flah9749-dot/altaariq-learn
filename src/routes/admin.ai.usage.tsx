import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Database, DollarSign, Zap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getAiUsageStats, clearAiCache } from "@/lib/ai-usage-stats.functions";

export const Route = createFileRoute("/admin/ai/usage")({
  head: () => ({ meta: [{ title: "استهلاك الذكاء الاصطناعي — الطارق التعليمية" }] }),
  component: AIUsagePage,
});

function AIUsagePage() {
  const qc = useQueryClient();
  const statsFn = useServerFn(getAiUsageStats);
  const clearFn = useServerFn(clearAiCache);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage-stats", 7],
    queryFn: () => statsFn({ data: { days: 7 } }),
  });

  const clearMut = useMutation({
    mutationFn: () => clearFn({ data: {} }),
    onSuccess: () => { toast.success("تم تفريغ الكاش"); qc.invalidateQueries({ queryKey: ["ai-usage-stats"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  if (isLoading) return <div className="p-6 space-y-3"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  const t = data?.totals;
  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">استهلاك الذكاء الاصطناعي</h1>
          <p className="text-sm text-muted-foreground">آخر {data?.windowDays ?? 7} أيام</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => clearMut.mutate()} disabled={clearMut.isPending}>
          <Trash2 className="w-4 h-4 ml-1" /> تفريغ الكاش
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Activity className="w-4 h-4" />} label="عدد الطلبات" value={t?.requests ?? 0} />
        <StatCard icon={<Zap className="w-4 h-4" />} label="نسبة Cache" value={`${Math.round((t?.cacheHitRate ?? 0) * 100)}%`} sub={`${t?.cacheHits ?? 0} إعادة`} />
        <StatCard icon={<Database className="w-4 h-4" />} label="Tokens مستخدمة" value={(t?.tokens ?? 0).toLocaleString()} />
        <StatCard icon={<DollarSign className="w-4 h-4" />} label="التكلفة التقديرية" value={`$${(t?.cost ?? 0).toFixed(4)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الأكثر استهلاكاً حسب المهمة</CardTitle>
          <CardDescription>ترتيب المهام حسب مجموع الـ Tokens</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data?.byTask ?? []).map((r) => (
              <div key={r.task} className="flex items-center justify-between text-sm border rounded p-2">
                <div className="font-medium">{r.task}</div>
                <div className="flex gap-3 text-muted-foreground">
                  <span>{r.count} طلب</span>
                  <span>{r.tokens.toLocaleString()} tk</span>
                  <span>${r.cost.toFixed(4)}</span>
                  {r.hits > 0 && <Badge variant="secondary">{r.hits} Cache</Badge>}
                </div>
              </div>
            ))}
            {(data?.byTask ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>حسب النموذج</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data?.byModel ?? []).map((r) => (
              <div key={r.model} className="flex items-center justify-between text-sm border rounded p-2">
                <div className="font-mono text-xs">{r.model}</div>
                <div className="flex gap-3 text-muted-foreground">
                  <span>{r.count} طلب</span>
                  <span>{r.tokens.toLocaleString()} tk</span>
                  <span>{r.avgLatency}ms</span>
                  <span>${r.cost.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="نتائج مخزنة (Cache)" value={data?.cacheEntries ?? 0} />
        <StatCard label="ملفات مستخرجة" value={data?.cachedDocuments ?? 0} />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon?: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
