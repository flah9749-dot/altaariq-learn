import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Lock, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayer } from "@/components/videos/VideoPlayer";
import { getVideoPlayback, saveVideoProgress, getVideoAttachmentUrl } from "@/lib/videos.functions";

export const Route = createFileRoute("/student/videos/$id")({
  head: () => ({
    meta: [
      { title: "مشاهدة الدرس — الفيديوهات التعليمية" },
      { name: "description", content: "شغّل الدرس المصوّر وتابع تقدمك من آخر نقطة توقفت عندها." },
      { property: "og:title", content: "مشاهدة الدرس — الفيديوهات التعليمية" },
      { property: "og:description", content: "شغّل الدرس المصوّر وتابع تقدمك من آخر نقطة توقفت عندها." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatchVideoPage,
});

function WatchVideoPage() {
  const { id } = Route.useParams();
  const playbackFn = useServerFn(getVideoPlayback);
  const progressFn = useServerFn(saveVideoProgress);
  const attUrlFn = useServerFn(getVideoAttachmentUrl);
  const [error, setError] = useState<string | null>(null);

  const { data: meta } = useQuery({
    queryKey: ["video-meta", id],
    queryFn: async () => (await supabase.from("videos").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["video-attachments", id],
    queryFn: async () => (await supabase.from("video_attachments").select("*").eq("video_id", id)).data ?? [],
  });

  const { data: progress } = useQuery({
    queryKey: ["video-progress", id],
    queryFn: async () => (await supabase.from("video_progress").select("position_sec,percent").eq("video_id", id).maybeSingle()).data,
  });

  const { data: playback, isLoading } = useQuery({
    queryKey: ["video-playback", id],
    retry: false,
    queryFn: async () => {
      try {
        return (await playbackFn({ data: { id } })) as any;
      } catch (e: any) {
        setError(e?.message ?? "غير متاح");
        return null;
      }
    },
  });

  const onProgress = useCallback(
    (pos: number, dur: number) => {
      progressFn({ data: { video_id: id, position_sec: pos, duration_sec: dur || 0 } }).catch(() => undefined);
    },
    [id, progressFn],
  );

  const openAttachment = async (attId: string) => {
    try {
      const r: any = await attUrlFn({ data: { id: attId } });
      window.open(r.url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر فتح المرفق");
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/student/videos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> رجوع للفيديوهات
      </Link>

      {isLoading ? (
        <Skeleton className="aspect-video w-full rounded-xl" />
      ) : error || !playback ? (
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">{error ?? "هذا الفيديو غير متاح لك"}</p>
            <p className="text-sm text-muted-foreground">الفيديو متاح للمشتركين أو أصحاب الصلاحية فقط.</p>
            <Button asChild variant="outline"><Link to="/student/messages">تواصل مع المدرس</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <VideoPlayer
          provider={playback.provider}
          url={playback.url}
          initialPosition={progress?.position_sec ?? 0}
          onProgress={onProgress}
        />
      )}

      {meta && (
        <Card>
          <CardHeader>
            <CardTitle>{meta.title}</CardTitle>
            <CardDescription>{[meta.term, meta.unit, meta.lesson].filter(Boolean).join(" • ")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{meta.description}</p>
            {progress?.percent ? <p className="text-xs text-muted-foreground">نسبة مشاهدتك: {progress.percent}%</p> : null}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">المرفقات</p>
                {attachments.map((a: any) => (
                  <Button key={a.id} variant="outline" size="sm" className="w-full justify-start" onClick={() => openAttachment(a.id)}>
                    <Paperclip className="ml-2 h-4 w-4" />{a.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
