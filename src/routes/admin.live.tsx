import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radio, Users, FileText, MessageSquare, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SectionTabs } from "@/components/admin/SectionTabs";

export const Route = createFileRoute("/admin/live")({ ssr: false, component: LivePage });

type PresenceUser = { userId: string; name?: string; role?: string; page?: string; at: number };

function LivePage() {
  const { user, profile } = useAuth();
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [counters, setCounters] = useState({ activeExams: 0, msgsToday: 0, notifsToday: 0, attemptsToday: 0 });

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("live-presence", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, PresenceUser[]>;
        const flat: PresenceUser[] = [];
        for (const arr of Object.values(state)) flat.push(...arr);
        setOnline(flat);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user.id,
            name: profile?.full_name ?? profile?.identifier ?? "مستخدم",
            role: "admin",
            page: "/admin/live",
            at: Date.now(),
          });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, profile?.full_name, profile?.identifier]);

  useEffect(() => {
    let mounted = true;
    async function loadCounters() {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const [exams, msgs, notifs, attempts] = await Promise.all([
        supabase.from("exam_attempts").select("id", { head: true, count: "exact" }).is("submitted_at", null),
        supabase.from("messages").select("id", { head: true, count: "exact" }).gte("created_at", iso),
        supabase.from("notifications").select("id", { head: true, count: "exact" }).gte("created_at", iso),
        supabase.from("exam_attempts").select("id", { head: true, count: "exact" }).gte("created_at", iso),
      ]);
      if (!mounted) return;
      setCounters({
        activeExams: exams.count ?? 0,
        msgsToday: msgs.count ?? 0,
        notifsToday: notifs.count ?? 0,
        attemptsToday: attempts.count ?? 0,
      });
    }
    loadCounters();
    const timer = setInterval(loadCounters, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const cards = [
    { label: "المستخدمون المتصلون الآن", value: online.length, icon: Users, color: "text-success" },
    { label: "امتحانات نشطة الآن", value: counters.activeExams, icon: FileText, color: "text-primary" },
    { label: "محاولات امتحان اليوم", value: counters.attemptsToday, icon: FileText, color: "text-accent" },
    { label: "رسائل اليوم", value: counters.msgsToday, icon: MessageSquare, color: "text-gold" },
    { label: "إشعارات اليوم", value: counters.notifsToday, icon: Bell, color: "text-warning" },
  ];

  return (
    <div className="space-y-4">
      <SectionTabs items={[{ to: "/admin/assistant", label: "المساعد الذكي" }, { to: "/admin/live", label: "اللوحة الحية" }]} />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Radio className="h-6 w-6 text-destructive animate-pulse"/> اللوحة الحية
        </h1>
        <p className="text-sm text-muted-foreground">تحديث لحظي عبر Supabase Realtime</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <c.icon className={`h-5 w-5 ${c.color}`}/>
              </div>
              <p className="text-3xl font-bold tabular-nums mt-2">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">المتصلون الآن ({online.length})</CardTitle></CardHeader>
        <CardContent>
          {online.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا يوجد متصلون في هذه اللوحة الآن.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {online.map((u, i) => (
                <Badge key={u.userId + i} variant="secondary" className="gap-1">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse inline-block"/>
                  {u.name ?? u.userId.slice(0, 6)} — {u.role ?? "—"}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
