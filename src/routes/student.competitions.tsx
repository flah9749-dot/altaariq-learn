import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Gift, Users, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/student/competitions")({
  component: StudentCompetitionsPage,
  head: () => ({
    meta: [
      { title: "المسابقات — الطارق التعليمية" },
      { name: "description", content: "شارك في المسابقات النشطة واربح النقاط والجوائز." },
    ],
  }),
});

type Competition = {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  prize: string | null;
  bonus_points: number;
  winners_count: number;
  active: boolean;
};

function StudentCompetitionsPage() {
  const { profile } = useAuth();
  const studentId = (profile as any)?.student_id ?? (profile as any)?.id;
  const [items, setItems] = useState<Competition[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const { data: comps } = await supabase
      .from("competitions")
      .select("*")
      .eq("active", true)
      .gte("ends_at", now)
      .order("ends_at", { ascending: true });
    setItems((comps ?? []) as Competition[]);

    if (studentId) {
      const { data: parts } = await supabase
        .from("competition_participants")
        .select("competition_id")
        .eq("student_id", studentId);
      setJoined(new Set((parts ?? []).map((p: any) => p.competition_id)));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [studentId]);

  const join = async (competitionId: string) => {
    if (!studentId) { toast.error("لم يتم التعرف على الطالب"); return; }
    const { error } = await supabase
      .from("competition_participants")
      .insert({ competition_id: competitionId, student_id: studentId, score: 0 });
    if (error) { toast.error("تعذر الاشتراك: " + error.message); return; }
    toast.success("تم الاشتراك في المسابقة ✨");
    setJoined((s) => new Set([...s, competitionId]));
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">المسابقات</h1>
          <p className="text-sm text-muted-foreground">شارك واربح نقاطًا وجوائز.</p>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">جارٍ التحميل...</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-2 opacity-50" />
          لا توجد مسابقات نشطة حاليًا. تابعنا قريبًا!
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((c) => {
            const isJoined = joined.has(c.id);
            return (
              <Card key={c.id} className="border-2 border-primary/10">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate">{c.name}</span>
                    {isJoined && <Badge variant="secondary">مشترك</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {c.description && <p className="text-muted-foreground">{c.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />
                      حتى {new Date(c.ends_at).toLocaleDateString("ar-EG")}
                    </span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />
                      {c.winners_count} فائز
                    </span>
                    <span className="flex items-center gap-1 text-primary font-semibold">
                      ⭐ {c.bonus_points} نقطة للفائز
                    </span>
                  </div>
                  {c.prize && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 text-amber-900 dark:text-amber-200">
                      <Gift className="h-4 w-4" /><span className="text-xs font-medium">{c.prize}</span>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    disabled={isJoined}
                    onClick={() => join(c.id)}
                  >
                    {isJoined ? "أنت مشترك بالفعل" : "اشترك الآن"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
