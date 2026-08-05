import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle, Lock, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/student/videos/")({
  head: () => ({
    meta: [
      { title: "الفيديوهات التعليمية — الطالب" },
      { name: "description", content: "شاهد دروس الدراسات الاجتماعية المصوّرة الخاصة بصفك ومجموعتك." },
      { property: "og:title", content: "الفيديوهات التعليمية — الطالب" },
      { property: "og:description", content: "شاهد دروس الدراسات الاجتماعية المصوّرة الخاصة بصفك ومجموعتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentVideosPage,
});

function StudentVideosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["student-videos"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("videos")
        .select("id,title,description,term,unit,lesson,thumbnail_url,duration_sec,access_type,publish_at")
        .order("created_at", { ascending: false });
      const list = rows ?? [];
      const checks = await Promise.all(
        list.map(async (v) => {
          const { data: ok } = await supabase.rpc("can_watch_video", { _video_id: v.id });
          return { ...v, locked: !ok };
        }),
      );
      return checks;
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Video className="h-6 w-6 text-primary" />الفيديوهات</h1>
        <p className="mt-1 text-sm text-muted-foreground">دروس مصوّرة خاصة بصفك ومجموعتك</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      ) : (data ?? []).length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد فيديوهات متاحة حالياً</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((v: any) => (
            <Card key={v.id} className="overflow-hidden transition hover:shadow-md">
              {v.thumbnail_url ? (
                <img src={v.thumbnail_url} alt={`صورة مصغرة لفيديو ${v.title}`} loading="lazy" className="aspect-video w-full object-cover" />
              ) : (
                <div className="grid aspect-video w-full place-items-center bg-primary/10"><PlayCircle className="h-10 w-10 text-primary" /></div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-6">{v.title}</CardTitle>
                  {v.locked && <Badge variant="secondary" className="shrink-0"><Lock className="ml-1 h-3 w-3" />مقفل</Badge>}
                </div>
                <CardDescription className="text-xs">{[v.term, v.unit, v.lesson].filter(Boolean).join(" • ")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
                {v.locked ? (
                  <p className="text-xs text-muted-foreground">هذا الفيديو متاح للمشتركين فقط — تواصل مع المدرس لتفعيل المشاهدة.</p>
                ) : (
                  <Link to="/student/videos/$id" params={{ id: v.id }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                    <PlayCircle className="h-4 w-4" /> مشاهدة
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
