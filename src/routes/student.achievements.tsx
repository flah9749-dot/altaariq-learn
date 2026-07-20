import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Medal, Trophy, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/student/achievements")({
  head: () => ({ meta: [{ title: "الشارات والإنجازات — الطارق التعليمية" }] }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const { profile } = useAuth();
  const studentId = profile?.id;

  const { data: badges } = useQuery({ queryKey: ["all-badges"], queryFn: async () => (await supabase.from("badges").select("*").eq("active",true)).data ?? [] });
  const { data: myBadges } = useQuery({ queryKey: ["my-badges", studentId], enabled: !!studentId,
    queryFn: async () => (await supabase.from("student_badges").select("*").eq("student_id", studentId!)).data ?? [] });
  const { data: achs } = useQuery({ queryKey: ["all-achs"], queryFn: async () => (await supabase.from("achievements").select("*").eq("active",true)).data ?? [] });
  const { data: myAchs, isLoading } = useQuery({ queryKey: ["my-achs", studentId], enabled: !!studentId,
    queryFn: async () => (await supabase.from("student_achievements").select("*").eq("student_id", studentId!)).data ?? [] });

  const earnedBadgeIds = new Set((myBadges ?? []).map((b: any) => b.badge_id));
  const earnedAchIds = new Set((myAchs ?? []).map((a: any) => a.achievement_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Trophy className="h-7 w-7 text-gold"/>الشارات والإنجازات</h1>
        <p className="text-sm text-muted-foreground mt-1">استعرض ما حققته وما تسعى للحصول عليه.</p>
      </div>

      <Tabs defaultValue="badges">
        <TabsList>
          <TabsTrigger value="badges"><Medal className="h-4 w-4 ml-1"/>الشارات ({earnedBadgeIds.size}/{badges?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="achievements"><Trophy className="h-4 w-4 ml-1"/>الإنجازات ({earnedAchIds.size}/{achs?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="badges">
          {isLoading ? <Skeleton className="h-40"/> : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 mt-4">
              {(badges ?? []).map((b: any) => {
                const earned = earnedBadgeIds.has(b.id);
                return (
                  <Card key={b.id} className={earned ? "" : "opacity-50"}>
                    <CardContent className="p-4 text-center space-y-2">
                      <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center text-white" style={{ background: earned ? b.color : "#94a3b8" }}>
                        {earned ? <Medal className="h-8 w-8"/> : <Lock className="h-6 w-6"/>}
                      </div>
                      <p className="font-bold text-sm">{b.name}</p>
                      {b.description && <p className="text-xs text-muted-foreground">{b.description}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="achievements">
          <div className="grid gap-3 sm:grid-cols-2 mt-4">
            {(achs ?? []).map((a: any) => {
              const earned = earnedAchIds.has(a.id);
              return (
                <Card key={a.id} className={earned ? "border-success" : ""}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${earned ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                      {earned ? <Trophy className="h-6 w-6"/> : <Lock className="h-5 w-5"/>}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                    {earned && <Badge className="bg-success text-success-foreground">مُنجَز</Badge>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
