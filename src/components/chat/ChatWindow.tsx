import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MessageCircle, FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { CameraDialog } from "@/components/chat/CameraDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sendMessage, markThreadRead, deleteMessage } from "@/lib/messaging.functions";
import { applyTemplate, type TemplateVars } from "@/lib/message-utils";

interface Props {
  peerId: string;              // the other party's user_id
  peerName?: string;
  peerSubtitle?: string;
  headerRight?: React.ReactNode;
  templateVars?: TemplateVars; // for template substitutions
}

export function ChatWindow({ peerId, peerName, peerSubtitle, headerRight, templateVars }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reply, setReply] = useState<any | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingCameraFile, setPendingCameraFile] = useState<File | null>(null);

  const sendFn = useServerFn(sendMessage);
  const readFn = useServerFn(markThreadRead);
  const delFn = useServerFn(deleteMessage);

  const key = ["thread", user?.id, peerId];

  const { data: messages, isLoading, error: messagesError } = useQuery({
    queryKey: key,
    enabled: !!user && !!peerId,
    queryFn: async () => {
      const { data, error } = await supabase.from("messages")
        .select("*").or(`and(sender_id.eq.${user!.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${user!.id})`)
        .order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["templates", "chat"],
    queryFn: async () => (await supabase.from("message_templates").select("*").eq("channel", "chat").order("name")).data ?? [],
  });

  // Realtime: incoming messages + read receipts
  useEffect(() => {
    if (!user || !peerId) return;
    const ch = supabase.channel(`chat-${user.id}-${peerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as any;
        if ((m.sender_id === user.id && m.recipient_id === peerId) ||
            (m.sender_id === peerId && m.recipient_id === user.id)) {
          qc.setQueryData<any[]>(key, (prev) => prev ? [...prev, m] : [m]);
          if (m.sender_id === peerId) readFn({ data: { peer_id: peerId } }).catch(() => {});
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as any;
        qc.setQueryData<any[]>(key, (prev) => prev ? prev.map((x) => x.id === m.id ? m : x) : prev);
      })
      .subscribe();

    // Presence for typing
    const presence = supabase.channel(`typing-${[user.id, peerId].sort().join("-")}`, {
      config: { presence: { key: user.id } },
    })
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState() as any;
        const peer = state[peerId]?.[0];
        setPeerTyping(!!peer?.typing);
      });
    presence.subscribe();
    (window as any).__typingChannel = presence;

    return () => { supabase.removeChannel(ch); supabase.removeChannel(presence); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, peerId]);

  // Mark read when opening
  useEffect(() => {
    if (user && peerId) readFn({ data: { peer_id: peerId } }).catch(() => {});
  }, [user, peerId, readFn]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: async (payload: any) => sendFn({
      data: {
        recipient_id: peerId,
        body: payload.body,
        message_type: payload.message_type,
        attachment_url: payload.attachment?.url ?? null,
        attachment_name: payload.attachment?.name ?? null,
        attachment_mime: payload.attachment?.mime ?? null,
        attachment_size: payload.attachment?.size ?? null,
        reply_to: payload.reply_to ?? null,
      },
    }),
    onSuccess: () => { setReply(null); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  const del = useMutation({
    mutationFn: async (m: any) => delFn({ data: { id: m.id } }),
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  // Typing indicator
  const typingTimer = useRef<number | null>(null);
  useEffect(() => {
    const ch = (window as any).__typingChannel;
    if (!ch) return;
    ch.track({ typing: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId]);

  const notifyTyping = () => {
    const ch = (window as any).__typingChannel;
    if (!ch) return;
    ch.track({ typing: true });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => ch.track({ typing: false }), 2000);
  };

  // Filter messages by search
  const visible = useMemo(() => {
    if (!search) return messages ?? [];
    return (messages ?? []).filter((m) =>
      (m.body ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (m.attachment_name ?? "").toLowerCase().includes(search.toLowerCase()));
  }, [messages, search]);

  // Group by day
  const grouped = useMemo(() => {
    const out: { day: string; items: any[] }[] = [];
    for (const m of visible) {
      const day = new Date(m.created_at).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [visible]);

  // Handle camera capture — inject file into composer via ref hack (simpler: pass through parent state)
  const composerRef = useRef<any>(null);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b p-3 flex items-center gap-3 bg-background sticky top-0 z-10">
        <MessageCircle className="h-6 w-6 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{peerName ?? "محادثة"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {peerTyping ? <span className="text-primary">يكتب الآن...</span> : peerSubtitle}
          </p>
        </div>
        <Popover open={!!search || undefined}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setSearch(search ? "" : " ")}>
              <Search className="h-4 w-4"/>
            </Button>
          </PopoverTrigger>
        </Popover>
        {templates && templates.length > 0 && (
          <Popover open={showTemplates} onOpenChange={setShowTemplates}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="قوالب"><FileText className="h-4 w-4"/></Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2" dir="rtl">
              <p className="text-xs font-semibold mb-2 text-muted-foreground">قوالب جاهزة</p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {templates.map((t) => (
                  <button key={t.id} type="button" onClick={() => {
                    const body = applyTemplate(t.body, templateVars ?? {});
                    send.mutate({ body, message_type: "text", attachment: undefined, reply_to: null });
                    setShowTemplates(false);
                  }} className="w-full text-right p-2 rounded hover:bg-muted text-xs">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-muted-foreground truncate">{t.body}</p>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {headerRight}
      </div>

      {search !== "" && (
        <div className="border-b p-2">
          <Input placeholder="بحث في الرسائل..." value={search.trim()} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs" autoFocus />
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-2 bg-gradient-to-b from-muted/20 to-background min-h-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-12 w-64" /><Skeleton className="h-12 w-72 ms-auto" /><Skeleton className="h-12 w-56" />
          </div>
        ) : messagesError ? (
          <div className="text-center py-16 text-destructive text-sm">تعذّر تحميل الرسائل. أعد فتح الصفحة.</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
            {search ? "لا توجد نتائج" : "ابدأ المحادثة بإرسال رسالة"}
          </div>
        ) : grouped.map((g) => (
          <div key={g.day} className="space-y-2">
            <div className="text-center">
              <Badge variant="secondary" className="text-[10px]">{g.day}</Badge>
            </div>
            {g.items.map((m: any) => (
              <MessageBubble key={m.id} m={m} own={m.sender_id === user?.id} onReply={setReply} onDelete={del.mutate} />
            ))}
          </div>
        ))}
        {send.isPending && <div className="flex justify-end px-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/></div>}
      </div>

      <div onKeyDown={notifyTyping}>
        <MessageComposer
          onSend={async (p) => { await send.mutateAsync(p); }}
          replyTo={reply}
          onClearReply={() => setReply(null)}
          onOpenCamera={() => setCameraOpen(true)}
          disabled={!peerId}
        />
      </div>

      <CameraDialog open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={async (file) => {
        // Send directly as image
        try {
          const { compressImage } = await import("@/lib/message-utils");
          const blob = await compressImage(file);
          const key = `${user!.id}/${Date.now()}-cam.jpg`;
          const { error } = await supabase.storage.from("chat-files").upload(key, blob, { contentType: "image/jpeg" });
          if (error) throw error;
          await send.mutateAsync({
            body: "", message_type: "image",
            attachment: { url: key, name: file.name, mime: "image/jpeg", size: (blob as any).size ?? 0 },
            reply_to: null,
          });
        } catch (e: any) { toast.error(e?.message ?? "فشل الإرسال"); }
      }} />
    </div>
  );
}
