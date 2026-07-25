import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface StudentBadges {
  messages: number;
  exams: number;
  rewards: number;
  achievements: number;
}

// Throttle helper: runs immediately then no more often than `ms`.
function useThrottledCallback(fn: () => void, ms: number) {
  const last = useRef(0);
  const timer = useRef<number | null>(null);
  return () => {
    const now = Date.now();
    const wait = Math.max(0, ms - (now - last.current));
    if (wait === 0) {
      last.current = now;
      fn();
    } else if (timer.current == null) {
      timer.current = window.setTimeout(() => {
        timer.current = null;
        last.current = Date.now();
        fn();
      }, wait);
    }
  };
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
        supabase.from("notifications").select("id, type", { head: false })
          .eq("user_id", user.id).eq("read", false).limit(50),
      ]);
      if (cancelled) return;
      const notifs = notif.data ?? [];
      const countCat = (needles: string[]) =>
        notifs.filter((n: any) => needles.some((k) => (n.type ?? "").toString().toLowerCase().includes(k))).length;
      setB({
        messages: msgs.count ?? 0,
        exams: countCat(["exam", "امتحان"]),
        rewards: countCat(["reward", "جائز", "مسابق", "compet"]),
        achievements: countCat(["achieve", "badge", "إنجاز", "شارة", "نقاط", "point", "level", "مستوى"]),
      });
    };

    // Throttle: at most one refetch every 5 seconds regardless of how many
    // realtime events arrive (avoids stampedes during exams / bulk publishes).
    let last = 0;
    let pending: number | null = null;
    const throttled = () => {
      const now = Date.now();
      const wait = Math.max(0, 5000 - (now - last));
      if (wait === 0) { last = now; fetchAll(); }
      else if (pending == null) {
        pending = window.setTimeout(() => { pending = null; last = Date.now(); fetchAll(); }, wait);
      }
    };

    fetchAll();
    // Safety poll every 2 min in case realtime drops.
    const poll = window.setInterval(fetchAll, 120000);

    const ch = supabase
      .channel(`student-badges-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, throttled)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, throttled)
      .subscribe();

    return () => {
      cancelled = true;
      if (pending) window.clearTimeout(pending);
      window.clearInterval(poll);
      supabase.removeChannel(ch);
    };
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

    // Only listen to the admin's own inbox in realtime; poll for the global
    // exam_attempts count every 60s instead of subscribing to every row
    // change (a global unfiltered subscription broadcasts every student's
    // per-keystroke answer save to every admin session — that's what
    // collapsed the platform under the 1000-student test).
    let last = 0;
    let pending: number | null = null;
    const throttled = () => {
      const now = Date.now();
      const wait = Math.max(0, 4000 - (now - last));
      if (wait === 0) { last = now; fetchAll(); }
      else if (pending == null) {
        pending = window.setTimeout(() => { pending = null; last = Date.now(); fetchAll(); }, wait);
      }
    };
    const poll = window.setInterval(fetchAll, 60000);

    const ch = supabase
      .channel(`admin-badges-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, throttled)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, throttled)
      .subscribe();

    return () => {
      cancelled = true;
      if (pending) window.clearTimeout(pending);
      window.clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [user?.id, role]);

  return b;
}

