import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { markNotificationRead } from "@/lib/announcements.functions";
import { relativeTime } from "@/lib/message-utils";
import { EnablePushButton } from "@/components/common/EnablePushButton";

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const markFn = useServerFn(markNotificationRead);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("notifications")
      .select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30)).data ?? [],
  });

  useEffect(() => {
    if (!user) return;
    // Stable channel name per user — using Math.random() in the name created
    // a fresh Realtime subscription on every remount (StrictMode / route
    // change / tab focus), leaking channels server-side and running the
    // per-connection quota down under load.
    const ch = supabase.channel(`notif-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          const n = payload?.new;
          if (!n) return;
          let href: string = n.link ?? "#";
          if (href === "/messages") {
            href = window.location.pathname.startsWith("/admin") ? "/admin/messages" : "/student/messages";
          }
          toast(n.title ?? "إشعار جديد", {
            description: n.body ?? "",
            action: href && href !== "#" ? {
              label: "عرض",
              onClick: () => { navigate({ to: href }); },
            } : undefined,
          });
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc, navigate]);


  const unread = (data ?? []).filter((n: any) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="الإشعارات">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] rounded-full">{unread}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir="rtl">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="font-semibold text-sm">الإشعارات</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs"
              onClick={async () => { await markFn({ data: { all: true } }); qc.invalidateQueries({ queryKey: ["notifications", user?.id] }); }}>
              <Check className="h-3 w-3 ml-1" />تعليم الكل كمقروء
            </Button>
          )}
        </div>
        <div className="px-3 py-2 border-b">
          <EnablePushButton className="w-full justify-center" />
        </div>
        <ScrollArea className="max-h-96">
          {(data ?? []).length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">لا توجد إشعارات</p>
          ) : (data ?? []).map((n: any) => {
            let href = n.link ?? "#";
            if (href === "/messages") {
              href = window.location.pathname.startsWith("/admin") ? "/admin/messages" : "/student/messages";
            }
            return (
            <Link key={n.id} to={href}
              onClick={async () => { if (!n.read) { await markFn({ data: { id: n.id } }); qc.invalidateQueries({ queryKey: ["notifications", user?.id] }); } }}
              className={`block border-b p-3 text-xs hover:bg-muted ${!n.read ? "bg-primary/5" : ""}`}>
              <div className="flex items-start gap-2">
                {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{relativeTime(n.created_at)}</p>
                </div>
              </div>
            </Link>
            );
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
