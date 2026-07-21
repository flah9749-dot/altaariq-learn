import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { getPrimaryAdminPeer } from "@/lib/messaging.functions";

export const Route = createFileRoute("/student/messages")({
  head: () => ({ meta: [{ title: "الرسائل — الطالب" }] }),
  component: StudentMessagesPage,
});

function StudentMessagesPage() {
  const { profile } = useAuth();
  const getPeer = useServerFn(getPrimaryAdminPeer);
  const { data: admin, isLoading, error } = useQuery({
    queryKey: ["student-primary-admin-peer"],
    queryFn: async () => getPeer(),
    retry: 1,
  });

  return (
    <div className="mx-auto max-w-4xl h-[calc(100dvh-7.5rem)] md:h-[calc(100vh-8rem)]">
      <Card className="flex flex-col overflow-hidden h-full">
        {admin?.user_id ? (
          <ChatWindow
            peerId={admin.user_id}
            peerName={admin.full_name}
            peerSubtitle="المدرس"
            templateVars={{ student_name: profile?.full_name ?? "", code: profile?.identifier ?? "" }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground p-6 text-center">
            {isLoading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">جارٍ فتح المحادثة مع المدرس...</p>
              </>
            ) : (
              <>
                <MessageSquare className="h-12 w-12 opacity-30" />
                <p className="text-sm">{error instanceof Error ? error.message : "تعذّر فتح المحادثة"}</p>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
