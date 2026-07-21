import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FolderOpen, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getFileUrl } from "@/lib/announcements.functions";
import { fileIconFor, humanSize, formatChatDetailedTime } from "@/lib/message-utils";

export const Route = createFileRoute("/student/files")({
  head: () => ({ meta: [{ title: "الملفات — الطالب" }] }),
  component: StudentFilesPage,
});

function StudentFilesPage() {
  const [q, setQ] = useState("");
  const urlFn = useServerFn(getFileUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["student-files-list"],
    queryFn: async () =>
      (await supabase.from("files").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const download = async (id: string) => {
    try {
      const r: any = await urlFn({ data: { id } });
      window.open(r.url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر التنزيل");
    }
  };

  const filtered = (data ?? []).filter((f: any) => !q || f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" />
          مكتبة الملفات
        </h1>
        <p className="text-muted-foreground text-sm mt-1">الموارد التعليمية التي شاركها المدرس معك</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">الملفات ({filtered.length})</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="pr-8 h-9" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">لا توجد ملفات متاحة حالياً</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((f: any) => {
                const Icon = fileIconFor(f.mime_type);
                return (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="rounded-md bg-primary/10 p-2 shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{f.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{humanSize(f.size)}</span>
                        <span>•</span>
                        <span>{formatChatDetailedTime(f.created_at)}</span>
                        {f.category && <Badge variant="outline" className="text-[10px] py-0">{f.category}</Badge>}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => download(f.id)}>
                      <Download className="h-4 w-4 ml-1" /> تحميل
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
