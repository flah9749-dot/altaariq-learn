import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const Route = createFileRoute("/student/messages")({
  head: () => ({ meta: [{ title: "الرسائل — الطالب" }] }),
  component: StudentMessagesPage,
});

function StudentMessagesPage() {
  const { profile } = useAuth();
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>("المدرس");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase.rpc("get_primary_admin");
        if (cancelled) return;
        if (error) throw new Error(error.message);
        const row = Array.isArray(data) ? data[0] : (data as any);
        if (row?.user_id) {
          setAdminUserId(row.user_id);
          setAdminName(row.full_name ?? "المدرس");
        } else {
          setLoadError("لم يتم إعداد حساب المدرس بعد. حاول لاحقًا.");
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? "تعذّر فتح الرسائل");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto max-w-4xl h-[calc(100vh-8rem)]">
      <Card className="flex flex-col overflow-hidden h-full">
        {adminUserId ? (
          <ChatWindow
            peerId={adminUserId}
            peerName={adminName}
            peerSubtitle="المدرس"
            templateVars={{ student_name: profile?.full_name ?? "", code: profile?.identifier ?? "" }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground p-6 text-center">
            {loading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">جارٍ فتح المحادثة مع المدرس...</p>
              </>
            ) : (
              <>
                <MessageSquare className="h-12 w-12 opacity-30" />
                <p className="text-sm">{loadError ?? "تعذّر فتح المحادثة"}</p>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
