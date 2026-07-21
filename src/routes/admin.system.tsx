import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Activity, CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { systemHealthCheck } from "@/lib/system-status.functions";
import { toast } from "sonner";
import { SectionTabs } from "@/components/admin/SectionTabs";

export const Route = createFileRoute("/admin/system")({ component: SystemPage });

type Check = { name: string; ok: boolean; latencyMs: number; detail?: string };

function SystemPage() {
  const check = useServerFn(systemHealthCheck);
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastAt, setLastAt] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    try {
      const res = await check();
      setChecks(res.checks);
      setLastAt(res.checkedAt);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الفحص");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  const okCount = checks.filter((c) => c.ok).length;
  const allOk = checks.length > 0 && okCount === checks.length;

  return (
    <div className="space-y-4">
      <SectionTabs items={[{ to: "/admin/system", label: "حالة النظام" }, { to: "/admin/backups", label: "النسخ الاحتياطي" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="h-6 w-6"/> حالة النظام</h1>
          <p className="text-sm text-muted-foreground">فحص لحظي لجميع الخدمات الأساسية</p>
        </div>
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 ml-2 animate-spin"/> : <RefreshCw className="h-4 w-4 ml-2"/>}
          إعادة الفحص
        </Button>
      </div>

      <Card className={allOk ? "border-success/40" : "border-border"}>
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">الحالة العامة</p>
            <p className="text-2xl font-bold">
              {loading ? "جاري الفحص..." : allOk ? "جميع الخدمات تعمل" : `${okCount}/${checks.length} خدمة تعمل`}
            </p>
            {lastAt && <p className="text-xs text-muted-foreground mt-1">آخر فحص: {new Date(lastAt).toLocaleString("ar-EG")}</p>}
          </div>
          <div className={`h-16 w-16 rounded-full flex items-center justify-center ${allOk ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}`}>
            {allOk ? <CheckCircle2 className="h-8 w-8"/> : <Activity className="h-8 w-8"/>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {checks.map((c) => (
          <Card key={c.name} className={c.ok ? "border-success/30" : "border-destructive/40"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="h-5 w-5 text-success"/> : <XCircle className="h-5 w-5 text-destructive"/>}
                  {c.name}
                </span>
                <Badge variant={c.ok ? "secondary" : "destructive"}>{c.ok ? "يعمل" : "خطأ"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>زمن الاستجابة: <span className="tabular-nums text-foreground">{c.latencyMs} مللي/ث</span></div>
              {c.detail && <div className="mt-1 text-destructive">{c.detail}</div>}
            </CardContent>
          </Card>
        ))}
        {!loading && checks.length === 0 && (
          <p className="text-muted-foreground">لم يبدأ الفحص بعد.</p>
        )}
      </div>
    </div>
  );
}
