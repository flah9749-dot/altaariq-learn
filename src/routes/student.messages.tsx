import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { supabase } from "@/integrations/supabase/client";
import { getPrimaryAdminPeer, getAllAdminPeerIds } from "@/lib/messaging.functions";

export const Route = createFileRoute("/student/messages")({
  head: () => ({ meta: [{ title: "الرسائل — الطالب" }] }),
  component: StudentMessagesPage,
});

function StudentMessagesPage() {
  const { profile } = useAuth();
  const getPeer = useServerFn(getPrimaryAdminPeer);
  const getAllPeers = useServerFn(getAllAdminPeerIds);
  const { data: admin, isLoading, error } = useQuery({
    queryKey: ["student-primary-admin-peer"],
    queryFn: async () => getPeer(),
    retry: 1,
  });
  const { data: allAdmins } = useQuery({
    queryKey: ["student-all-admin-peers"],
    queryFn: async () => getAllPeers(),
    staleTime: 60_000,
  });

  // Live-fetch teacher WhatsApp so updates from settings propagate immediately.
  const { data: teacherWa } = useQuery({
    queryKey: ["setting", "teacher.whatsapp"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "teacher.whatsapp").maybeSingle();
      const v = data?.value as any;
      return (typeof v === "string" ? v : v?.toString?.()) ?? "";
    },
  });

  return (
    <div className="mx-auto h-[calc(100dvh-12rem)] max-w-4xl sm:h-[calc(100dvh-8rem)] md:h-[calc(100vh-8rem)]">
      <Card className="flex h-full flex-col overflow-hidden">
        {admin?.user_id ? (
          <ChatWindow
            peerId={admin.user_id}
            peerName={admin.full_name}
            peerSubtitle="المدرس"
            extraPeerIds={(allAdmins?.ids ?? []).filter((id) => id !== admin.user_id)}
            templateVars={{ student_name: profile?.full_name ?? "", code: profile?.identifier ?? "" }}
            headerRight={teacherWa ? (
              <WhatsAppButton
                phone={teacherWa}
                label="واتساب"
                size="sm"
                template="wa.tpl.teacher_contact"
                vars={{ name: profile?.full_name ?? "", code: profile?.identifier ?? "" }}
              />
            ) : undefined}

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
