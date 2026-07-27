import { useQuery } from "@tanstack/react-query";
import { Trophy, GraduationCap, Users, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function WeeklyChampionsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["weekly-champions"],
    queryFn: async () => {
      const { data } = await supabase.rpc("weekly_champions");
      return (data as any) ?? {};
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card className="overflow-hidden border-gold/40 bg-gradient-to-br from-gold/10 via-background to-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-gold" />
          كأس الأسبوع
          <span className="text-xs font-normal text-muted-foreground mr-auto">آخر 7 أيام</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
          </>
        ) : (
          <>
            <ChampionTile
              icon={Sparkles}
              title="أفضل طالب"
              name={data?.top_student?.full_name}
              stat={data?.top_student?.week_points != null ? `+${data.top_student.week_points} نقطة` : null}
              accent="text-gold"
            />
            <ChampionTile
              icon={GraduationCap}
              title="أفضل صف"
              name={data?.top_class?.name}
              stat={data?.top_class?.avg_pct != null ? `متوسط ${data.top_class.avg_pct}%` : null}
              accent="text-primary"
            />
            <ChampionTile
              icon={Users}
              title="أفضل مجموعة"
              name={data?.top_group?.name}
              stat={data?.top_group?.avg_pct != null ? `متوسط ${data.top_group.avg_pct}%` : null}
              sub={data?.top_group?.class_name}
              accent="text-accent"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ChampionTile({ icon: Icon, title, name, stat, sub, accent }: any) {
  return (
    <div className="rounded-xl border bg-background/60 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Icon className={`h-4 w-4 ${accent}`} />{title}
      </div>
      {name ? (
        <>
          <p className="font-bold text-lg leading-tight truncate">{name}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
          {stat && <p className={`text-sm font-semibold mt-1 ${accent}`}>{stat}</p>}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">لا توجد بيانات كافية</p>
      )}
    </div>
  );
}
