import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/student/points")({
  head: () => ({ meta: [{ title: "نقاطي — الطارق التعليمية" }] }),
  component: PointsPage,
});

function PointsPage() {
  const { profile } = useAuth();
  const studentId = profile?.id;

  const { data: me } = useQuery({
    queryKey: ["me-full", studentId], enabled: !!studentId,
    queryFn: async () => (await supabase.from("students").select("points,level").eq("id", studentId!).maybeSingle()).data,
  });
  const { data: log, isLoading } = useQuery({
    queryKey: ["points-log", studentId], enabled: !!studentId,
    queryFn: async () => (await supabase.from("points_log").select("*").eq("student_id", studentId!).order("created_at",{ascending:false}).limit(100)).data ?? [],
  });
  const { data: levels } = useQuery({
    queryKey: ["levels-active"], queryFn: async () => (await supabase.from("levels").select("*").eq("active",true).order("order_index")).data ?? [],
  });

  const points = me?.points ?? 0;
  const level = me?.level ?? 1;
  const currentLvl = (levels ?? []).find((l: any) => l.order_index === level);
  const nextLvl = (levels ?? []).find((l: any) => l.order_index === level + 1);
  const progress = nextLvl ? Math.min(100, Math.round(((points - (currentLvl?.min_points ?? 0)) / ((nextLvl.min_points - (currentLvl?.min_points ?? 0)) || 1)) * 100)) : 100;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground border-0">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm opacity-80">رصيد النقاط</p>
              <p className="text-4xl font-bold mt-1">⭐ {points}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">المستوى الحالي</p>
              <p className="text-2xl font-bold mt-1" style={{ color: currentLvl?.color ?? undefined }}>{currentLvl?.name ?? `مستوى ${level}`}</p>
            </div>
          </div>
          {nextLvl && (
            <div>
              <div className="flex justify-between text-xs opacity-90 mb-1"><span>التالي: {nextLvl.name}</span><span>{points} / {nextLvl.min_points}</span></div>
              <Progress value={progress} className="h-2 bg-white/20"/>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-gold"/>سجل النقاط</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <Skeleton className="h-40"/> : (log ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">لا توجد عمليات بعد.</p>
          ) : log!.map((l: any) => {
            const positive = l.points >= 0;
            return (
              <div key={l.id} className="flex items-center gap-3 border-b pb-2">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center ${positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {positive ? <TrendingUp className="h-4 w-4"/> : <TrendingDown className="h-4 w-4"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{l.reason}</p>
                  <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-EG")}</p>
                </div>
                <Badge variant={positive ? "default" : "destructive"}>{positive ? "+" : ""}{l.points}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
