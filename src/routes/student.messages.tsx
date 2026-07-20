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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("admins").select("user_id, full_name").not("user_id","is",null).limit(1).maybeSingle();
      if (data) { setAdminUserId(data.user_id); setAdminName(data.full_name ?? "المدرس"); }
    })();
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
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">جارٍ التحميل...</p>
            <MessageSquare className="h-12 w-12 opacity-30" />
          </div>
        )}
      </Card>
    </div>
  );
}
