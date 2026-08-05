import { useEffect, useRef, useState } from "react";

type Props = {
  provider: string;
  url: string;
  initialPosition?: number;
  onProgress?: (positionSec: number, durationSec: number) => void;
};

function youtubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return m?.[1] ?? "";
}

/** Loads the YouTube IFrame API once. */
function loadYT(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  return new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(w.YT); };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
}

export function VideoPlayer({ provider, url, initialPosition = 0, onProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytHost = useRef<HTMLDivElement>(null);
  const lastSent = useRef(0);
  const [rate, setRate] = useState(1);

  const isNative = provider === "upload" || provider === "url";
  const isYT = provider === "youtube";

  // Native <video>: restore position, report progress every 10s.
  useEffect(() => {
    if (!isNative) return;
    const el = videoRef.current;
    if (!el) return;
    const onMeta = () => { if (initialPosition > 0 && initialPosition < el.duration - 5) el.currentTime = initialPosition; };
    const onTime = () => {
      const now = Date.now();
      if (now - lastSent.current < 10_000) return;
      lastSent.current = now;
      onProgress?.(Math.floor(el.currentTime), Math.floor(el.duration || 0));
    };
    const onEnd = () => onProgress?.(Math.floor(el.duration || 0), Math.floor(el.duration || 0));
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
      onProgress?.(Math.floor(el.currentTime), Math.floor(el.duration || 0));
    };
  }, [isNative, initialPosition, onProgress]);

  // YouTube: IFrame API for resume + progress polling.
  useEffect(() => {
    if (!isYT || !ytHost.current) return;
    let player: any;
    let timer: any;
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !ytHost.current) return;
      player = new YT.Player(ytHost.current, {
        videoId: youtubeId(url),
        playerVars: { start: Math.floor(initialPosition), rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            timer = setInterval(() => {
              try {
                const pos = Math.floor(player.getCurrentTime?.() ?? 0);
                const dur = Math.floor(player.getDuration?.() ?? 0);
                if (pos > 0) onProgress?.(pos, dur);
              } catch {}
            }, 10_000);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      try { player?.destroy?.(); } catch {}
    };
  }, [isYT, url, initialPosition, onProgress]);

  if (isYT) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <div ref={ytHost} className="h-full w-full" />
      </div>
    );
  }

  if (!isNative) {
    // Bunny / Cloudflare Stream embeds
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={url}
          className="h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title="مشغل الفيديو"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        src={url}
        controls
        playsInline
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="aspect-video w-full rounded-xl bg-black"
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>سرعة التشغيل</span>
        {[0.75, 1, 1.25, 1.5, 2].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => { setRate(r); if (videoRef.current) videoRef.current.playbackRate = r; }}
            className={`rounded-md border px-2 py-1 ${rate === r ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  );
}
