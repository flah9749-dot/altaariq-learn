import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Search, Send, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { BroadcastDialog } from "@/components/chat/BroadcastDialog";
import { getAllAdminPeerIds } from "@/lib/messaging.functions";
import { formatChatTime } from "@/lib/message-utils";


export const Route = createFileRoute("/admin/messages")({
  head: () => ({ meta: [{ title: "الرسائل — لوحة المدرس" }] }),
  component: AdminMessagesPage,
});

function AdminMessagesPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<{ userId: string; name: string; parentPhone: string | null; code: string; className?: string; groupName?: string } | null>(null);
  const [q, setQ] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [classId, setClassId] = useState<string>("all");
  const [groupId, setGroupId] = useState<string>("all");
  const [tab, setTab] = useState<"all" | "unread" | "online">("all");

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-basic"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups-basic"],
    queryFn: async () => (await supabase.from("groups").select("id,name,class_id, classes(name)").order("name")).data ?? [],
  });
  const filteredGroups = useMemo(
    () => (classId === "all" ? groups : groups.filter((g: any) => g.class_id === classId)),
    [groups, classId],
  );


  const { data: students, isLoading } = useQuery({
    queryKey: ["messages-students"],
    queryFn: async () => (await supabase.from("students")
      .select("id, user_id, code, full_name, avatar_url, is_online, parent_whatsapp, parent_phone, class_id, group_id, classes(name), groups(name)")
      .not("user_id", "is", null).eq("status", "active").order("full_name")).data ?? [],
  });

  const getAdminIds = useServerFn(getAllAdminPeerIds);
  const { data: adminIdsData } = useQuery({
    queryKey: ["all-admin-peer-ids"],
    enabled: !!user,
    queryFn: () => getAdminIds(),
    staleTime: 5 * 60 * 1000,
  });
  const adminIds = useMemo(() => {
    const set = new Set<string>([user?.id, ...((adminIdsData?.ids ?? []) as string[])].filter(Boolean) as string[]);
    return Array.from(set);
  }, [adminIdsData, user?.id]);
  const otherAdminIds = useMemo(
    () => adminIds.filter((id) => id !== user?.id),
    [adminIds, user?.id],
  );
  const adminIdsKey = adminIds.slice().sort().join(",");

  const { data: threads } = useQuery({
    queryKey: ["message-threads", adminIdsKey],
    enabled: !!user && adminIds.length > 0,
    queryFn: async () => {
      const inList = adminIds.map((p) => `"${p}"`).join(",");
      const { data } = await supabase.from("messages")
        .select("sender_id,recipient_id,body,created_at,read,attachment_name")
        .or(`sender_id.in.(${inList}),recipient_id.in.(${inList})`)
        .order("created_at", { ascending: false }).limit(2000);
      const adminSet = new Set(adminIds);
      const map = new Map<string, { last: any; unread: number }>();
      for (const m of data ?? []) {
        // The "other party" is the non-admin side of the conversation.
        const other = (adminSet.has(m.sender_id as string) ? m.recipient_id : m.sender_id) as string | null;
        if (!other || adminSet.has(other)) continue; // ignore admin<->admin noise
        const cur = map.get(other) ?? { last: null, unread: 0 };
        if (!cur.last) cur.last = m;
        // Count unread only for messages addressed to THIS admin (per-admin inbox state).
        if (m.recipient_id === user!.id && !m.read) cur.unread++;
        map.set(other, cur);
      }
      return map;
    },
  });


  const filtered = useMemo(() => {
    let list = students ?? [];
    if (classId !== "all") list = list.filter((x: any) => x.class_id === classId);
    if (groupId !== "all") list = list.filter((x: any) => x.group_id === groupId);
    if (tab === "online") list = list.filter((x: any) => x.is_online);
    if (tab === "unread") list = list.filter((x: any) => (threads?.get(x.user_id)?.unread ?? 0) > 0);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((x: any) =>
        x.full_name?.toLowerCase().includes(s) ||
        x.code?.toLowerCase().includes(s) ||
        x.classes?.name?.toLowerCase().includes(s));
    }
    return list;
  }, [students, q, classId, groupId, tab, threads]);

  const unreadTotal = useMemo(() => {
    if (!threads) return 0;
    let n = 0; threads.forEach((v) => { n += v.unread; });
    return n;
  }, [threads]);
  const onlineTotal = useMemo(() => (students ?? []).filter((x: any) => x.is_online).length, [students]);

  const sorted = useMemo(() => {
    if (!threads) return filtered;
    return [...filtered].sort((a: any, b: any) => {
      const ta = threads.get(a.user_id)?.last?.created_at ?? "";
      const tb = threads.get(b.user_id)?.last?.created_at ?? "";
      return tb.localeCompare(ta);
    });
  }, [filtered, threads]);


  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 h-[calc(100vh-8rem)]">
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary"/>المحادثات</h2>
            <Button size="sm" variant="outline" onClick={() => setBroadcastOpen(true)}>
              <Users2 className="h-4 w-4 ml-1"/>بث
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الكود..." className="pr-8 h-9"/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={classId} onValueChange={(v) => {
              setClassId(v);
              // احتفظ بالمجموعة إذا كانت تنتمي للصف الجديد، وإلا أعد التعيين
              if (v !== "all" && groupId !== "all") {
                const g = groups.find((x: any) => x.id === groupId);
                if (!g || g.class_id !== v) setGroupId("all");
              }
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="الصف"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الصفوف</SelectItem>
                {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={groupId} onValueChange={(v) => {
              setGroupId(v);
              // عند اختيار مجموعة، اضبط الصف تلقائياً على صف تلك المجموعة
              if (v !== "all") {
                const g = groups.find((x: any) => x.id === v);
                if (g?.class_id && g.class_id !== classId) setClassId(g.class_id);
              }
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="المجموعة"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المجموعات</SelectItem>
                {filteredGroups.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}{classId === "all" && g.classes?.name ? ` — ${g.classes.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-3 h-8 w-full">
              <TabsTrigger value="all" className="text-xs">الكل ({(students ?? []).length})</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">غير مقروء {unreadTotal > 0 && <Badge className="ms-1 h-4 min-w-4 px-1 text-[10px]">{unreadTotal}</Badge>}</TabsTrigger>
              <TabsTrigger value="online" className="text-xs">متصل ({onlineTotal})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-3 space-y-2">{Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-14 w-full"/>)}</div>
          ) : sorted.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">لا يوجد طلاب</p>
          ) : sorted.map((s: any) => {
            const t = threads?.get(s.user_id);
            const active = selected?.userId === s.user_id;
            return (
              <button key={s.id} onClick={() => setSelected({
                userId: s.user_id, name: s.full_name, code: s.code,
                parentPhone: s.parent_whatsapp ?? s.parent_phone,
                className: s.classes?.name, groupName: s.groups?.name,
              })} className={`w-full text-right p-3 border-b transition-colors ${active ? "bg-primary/10" : "hover:bg-muted"}`}>
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar className="h-11 w-11"><AvatarImage src={s.avatar_url ?? undefined}/><AvatarFallback>{s.full_name?.[0] ?? "ط"}</AvatarFallback></Avatar>
                    {s.is_online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background"/>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate">{s.full_name}</p>
                      {t?.last && <span className="text-[10px] text-muted-foreground shrink-0">{formatChatTime(t.last.created_at)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {t?.last ? (t.last.body || `📎 ${t.last.attachment_name ?? "مرفق"}`) : `${s.code}${s.classes?.name ? " • " + s.classes.name : ""}`}
                      </p>
                      {t && t.unread > 0 && <Badge className="h-5 min-w-5 px-1.5 text-[10px] rounded-full">{t.unread}</Badge>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </Card>

      <Card className="flex flex-col overflow-hidden min-h-0">
        {selected ? (
          <ChatWindow
            peerId={selected.userId}
            peerName={selected.name}
            peerSubtitle={`${selected.code}${selected.className ? " • " + selected.className : ""}${selected.groupName ? " • " + selected.groupName : ""}`}
            templateVars={{ student_name: selected.name, code: selected.code }}
            headerRight={selected.parentPhone ? (
              <WhatsAppButton phone={selected.parentPhone} template="wa.tpl.parent_intro" vars={{ name: selected.name }} label="واتساب ولي الأمر" size="sm" />
            ) : null}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground p-8 text-center">
            <MessageSquare className="h-16 w-16 opacity-30" />
            <p>اختر طالبًا من القائمة لبدء المحادثة</p>
            <Button variant="outline" onClick={() => setBroadcastOpen(true)}><Send className="h-4 w-4 ml-1"/>أرسل رسالة جماعية</Button>
          </div>
        )}
      </Card>

      <BroadcastDialog open={broadcastOpen} onClose={() => setBroadcastOpen(false)} />
    </div>
  );
}
