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
  peerId: string;              // the other party's user_id (sends go to this id)
  peerName?: string;
  peerSubtitle?: string;
  headerRight?: React.ReactNode;
  templateVars?: TemplateVars; // for template substitutions
  /** Optional extra peer user_ids to include in the same thread view (e.g. other admins on the student side). */
  extraPeerIds?: string[];
  /** Optional extra "me" user_ids — messages from/to any of these ids are considered part of my side (e.g. other admin accounts sharing the same student thread). */
  selfPeerIds?: string[];
}

export function ChatWindow({ peerId, peerName, peerSubtitle, headerRight, templateVars, extraPeerIds, selfPeerIds }: Props) {
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

  const allPeerIds = useMemo(() => {
    const set = new Set<string>([peerId, ...(extraPeerIds ?? [])].filter(Boolean));
    return Array.from(set);
  }, [peerId, extraPeerIds]);
  const allSelfIds = useMemo(() => {
    const set = new Set<string>([user?.id, ...(selfPeerIds ?? [])].filter(Boolean) as string[]);
    return Array.from(set);
  }, [user?.id, selfPeerIds]);
  const peerKey = allPeerIds.slice().sort().join(",");
  const selfKey = allSelfIds.slice().sort().join(",");

  const key = ["thread", selfKey, peerKey];

  const { data: messages, isLoading, error: messagesError } = useQuery({
    queryKey: key,
    enabled: !!user && allPeerIds.length > 0 && allSelfIds.length > 0,
    queryFn: async () => {
      const peers = allPeerIds.map((p) => `"${p}"`).join(",");
      const selves = allSelfIds.map((p) => `"${p}"`).join(",");
      const { data, error } = await supabase.from("messages")
        .select("*")
        .or(`and(sender_id.in.(${selves}),recipient_id.in.(${peers})),and(recipient_id.in.(${selves}),sender_id.in.(${peers}))`)
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
    if (!user || allPeerIds.length === 0 || allSelfIds.length === 0) return;
    const peerSet = new Set(allPeerIds);
    const selfSet = new Set(allSelfIds);
    const ch = supabase.channel(`chat-${selfKey}-${peerKey}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as any;
        const involvesUs =
          (selfSet.has(m.sender_id) && peerSet.has(m.recipient_id)) ||
          (peerSet.has(m.sender_id) && selfSet.has(m.recipient_id));
        if (involvesUs) {
          qc.setQueryData<any[]>(key, (prev) => prev ? [...prev, m] : [m]);
          if (peerSet.has(m.sender_id)) readFn({ data: { peer_ids: allPeerIds } }).catch(() => {});
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as any;
        qc.setQueryData<any[]>(key, (prev) => prev ? prev.map((x) => x.id === m.id ? m : x) : prev);
      })
      .subscribe();

    // Presence for typing (still scoped to primary peer)
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
  }, [user?.id, peerKey, selfKey]);


  // Mark read when opening
  useEffect(() => {
    if (user && allPeerIds.length > 0) readFn({ data: { peer_ids: allPeerIds } }).catch(() => {});
  }, [user, peerKey, readFn]);

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
            <Button variant="ghost" size="icon" aria-label="بحث في المحادثة" onClick={() => setSearch(search ? "" : " ")}>
              <Search className="h-4 w-4"/>
            </Button>
          </PopoverTrigger>
        </Popover>
        {templates && templates.length > 0 && (
          <Popover open={showTemplates} onOpenChange={setShowTemplates}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="قوالب" aria-label="قوالب جاهزة"><FileText className="h-4 w-4"/></Button>
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
              <MessageBubble key={m.id} m={m} own={allSelfIds.includes(m.sender_id)} onReply={setReply} onDelete={del.mutate} />
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
