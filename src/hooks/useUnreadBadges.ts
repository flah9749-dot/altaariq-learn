import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface StudentBadges {
  messages: number;
  exams: number;
  rewards: number;
  achievements: number;
}

export function useStudentUnreadBadges() {
  const { user, profile, role } = useAuth();
  const [b, setB] = useState<StudentBadges>({ messages: 0, exams: 0, rewards: 0, achievements: 0 });

  useEffect(() => {
    if (role !== "student" || !user?.id || !profile?.id) return;
    let cancelled = false;

    const fetchAll = async () => {
      const [msgs, notif] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id).eq("read", false),
        supabase.from("notifications").select("id, category", { head: false })
          .eq("user_id", user.id).eq("read", false),
      ]);
      if (cancelled) return;
      const notifs = notif.data ?? [];
      const countCat = (needles: string[]) =>
        notifs.filter((n: any) => needles.some((k) => (n.category ?? "").toString().toLowerCase().includes(k))).length;
      setB({
        messages: msgs.count ?? 0,
        exams: countCat(["exam", "امتحان"]),
        rewards: countCat(["reward", "جائز", "مسابق", "compet"]),
        achievements: countCat(["achieve", "badge", "إنجاز", "شارة", "نقاط", "point", "level", "مستوى"]),
      });
    };

    fetchAll();

    const ch = supabase
      .channel(`student-badges-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, fetchAll)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user?.id, profile?.id, role]);

  return b;
}

export interface AdminBadges {
  messages: number;
  results: number;
  notifications: number;
}

export function useAdminUnreadBadges() {
  const { user, role } = useAuth();
  const [b, setB] = useState<AdminBadges>({ messages: 0, results: 0, notifications: 0 });

  useEffect(() => {
    if (role !== "admin" || !user?.id) return;
    let cancelled = false;

    const fetchAll = async () => {
      const [msgs, results, notif] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id).eq("read", false),
        supabase.from("exam_attempts").select("id", { count: "exact", head: true })
          .eq("status", "submitted").is("approved_at", null),
        supabase.from("notifications").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("read", false),
      ]);
      if (cancelled) return;
      setB({
        messages: msgs.count ?? 0,
        results: results.count ?? 0,
        notifications: notif.count ?? 0,
      });
    };

    fetchAll();

    const ch = supabase
      .channel(`admin-badges-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_attempts" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, fetchAll)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user?.id, role]);

  return b;
}
