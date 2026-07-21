import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, ShoppingBag, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { redeemReward } from "@/lib/gamification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { toast } from "sonner";

export const Route = createFileRoute("/student/rewards")({
  head: () => ({ meta: [{ title: "متجر الجوائز — الطارق التعليمية" }] }),
  component: StudentRewardsPage,
});

function StudentRewardsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const studentId = profile?.id;

  const { data: me } = useQuery({
    queryKey: ["me-points", studentId], enabled: !!studentId,
    queryFn: async () => (await supabase.from("students").select("points,level,parent_whatsapp,parent_phone,full_name").eq("id", studentId!).maybeSingle()).data,
  });
  const { data: catalog, isLoading } = useQuery({
    queryKey: ["catalog"], queryFn: async () => (await supabase.from("reward_catalog").select("*").eq("active", true).order("points_cost")).data ?? [],
  });
  const { data: mine } = useQuery({
    queryKey: ["my-redemptions", studentId], enabled: !!studentId,
    queryFn: async () => (await supabase.from("reward_redemptions").select("*, reward_catalog(title,image_url)").eq("student_id", studentId!).order("created_at",{ascending:false})).data ?? [],
  });

  const doRedeem = async (rewardId: string, cost: number) => {
    if ((me?.points ?? 0) < cost) return toast.error("رصيد النقاط غير كافٍ");
    if (!confirm(`استبدال هذه الجائزة مقابل ${cost} نقطة؟`)) return;
    try {
      await redeemReward(studentId!, rewardId);
      toast.success("تم إرسال طلب الاستبدال");
      qc.invalidateQueries({ queryKey: ["me-points"] });
      qc.invalidateQueries({ queryKey: ["my-redemptions"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const parentPhone = me?.parent_whatsapp ?? me?.parent_phone;

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-gradient-to-l from-gold/80 to-gold/30">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm">رصيدك الحالي</p>
            <p className="text-4xl font-bold mt-1">⭐ {me?.points ?? 0}</p>
          </div>
          <WhatsAppButton
            phone={parentPhone}
            template="wa.tpl.rewards_summary"
            vars={{
              name: me?.full_name ?? "",
              points: me?.points ?? 0,
              rank: "—",
              rewards_count: (mine ?? []).length,
            }}
            label="إرسال ملخص النقاط لولي الأمر"
          />

        </CardContent>
      </Card>

      <Tabs defaultValue="shop">
        <TabsList>
          <TabsTrigger value="shop"><ShoppingBag className="h-4 w-4 ml-1"/>المتجر</TabsTrigger>
          <TabsTrigger value="mine"><Package className="h-4 w-4 ml-1"/>طلباتي</TabsTrigger>
        </TabsList>

        <TabsContent value="shop">
          {isLoading ? <Skeleton className="h-40"/> : (catalog ?? []).length === 0 ? (
            <Card><CardContent className="text-center py-16 text-muted-foreground">لا توجد جوائز متاحة حاليًا.</CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {catalog!.map((r: any) => {
                const canAfford = (me?.points ?? 0) >= r.points_cost;
                const outOfStock = r.stock !== null && r.stock <= 0;
                return (
                  <Card key={r.id} className="overflow-hidden flex flex-col">
                    {r.image_url ? <img src={r.image_url} alt={r.title} className="h-32 w-full object-cover"/> :
                      <div className="h-32 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"><Award className="h-12 w-12 text-primary"/></div>}
                    <CardContent className="p-4 flex-1 flex flex-col gap-2">
                      <p className="font-bold">{r.title}</p>
                      {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <Badge className="bg-gold text-gold-foreground">⭐ {r.points_cost}</Badge>
                        {r.stock !== null && <span className="text-xs text-muted-foreground">متبقي: {r.stock}</span>}
                      </div>
                      <Button size="sm" disabled={!canAfford || outOfStock} onClick={()=>doRedeem(r.id, r.points_cost)}>
                        {outOfStock ? "نفدت الكمية" : canAfford ? "استبدال" : "نقاط غير كافية"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine">
          <div className="space-y-2 mt-4">
            {(mine ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-10">لم تستبدل أي جوائز بعد.</p>}
            {(mine ?? []).map((r: any) => (
              <Card key={r.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  {r.reward_catalog?.image_url && <img src={r.reward_catalog.image_url} alt={r.reward_catalog?.title ?? "جائزة"} className="h-14 w-14 rounded object-cover"/>}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{r.reward_catalog?.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-EG")} • ⭐ {r.points_spent}</p>
                  </div>
                  <Badge variant={r.status==="delivered"?"default":r.status==="cancelled"?"destructive":"outline"}>
                    {r.status==="pending"?"قيد الانتظار":r.status==="delivered"?"تم التسليم":"ملغى"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
