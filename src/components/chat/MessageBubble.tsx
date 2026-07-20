import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fileIconFor, humanSize, formatChatDetailedTime, isImageMime } from "@/lib/message-utils";
import { Check, CheckCheck, Download, Reply, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  m: any;
  own: boolean;
  onReply?: (m: any) => void;
  onDelete?: (m: any) => void;
}

export function MessageBubble({ m, own, onReply, onDelete }: Props) {
  const [signed, setSigned] = useState<string | null>(null);

  const loadUrl = async (): Promise<string | null> => {
    if (signed) return signed;
    if (!m.attachment_url) return null;
    // stored as path within chat-files
    const { data, error } = await supabase.storage.from("chat-files").createSignedUrl(m.attachment_url, 3600);
    if (error) { toast.error("تعذر فتح المرفق"); return null; }
    setSigned(data.signedUrl);
    return data.signedUrl;
  };

  const openAttachment = async () => {
    const url = await loadUrl();
    if (url) window.open(url, "_blank", "noopener");
  };

  const Icon = fileIconFor(m.attachment_mime);
  const image = isImageMime(m.attachment_mime);
  const audio = m.attachment_mime?.startsWith("audio/");
  const video = m.attachment_mime?.startsWith("video/");

  const bubbleClass = own
    ? "bg-primary text-primary-foreground rounded-2xl rounded-tl-md"
    : "bg-card border rounded-2xl rounded-tr-md";

  return (
    <div className={`group flex ${own ? "justify-end" : "justify-start"} px-2`}>
      <div className={`relative max-w-[85%] sm:max-w-[70%] ${bubbleClass} p-2.5 shadow-sm animate-in fade-in slide-in-from-bottom-1`}>
        {m.deleted_at ? (
          <p className="text-xs italic opacity-70">🚫 تم حذف الرسالة</p>
        ) : (
          <>
            {image && (
              <button onClick={openAttachment} className="block mb-1.5 rounded-lg overflow-hidden max-w-[280px]">
                <AttachmentImage m={m} />
              </button>
            )}
            {audio && (
              <div className="mb-1.5">
                <AttachmentAudio m={m} />
              </div>
            )}
            {video && (
              <div className="mb-1.5">
                <AttachmentVideo m={m} />
              </div>
            )}
            {!image && !audio && !video && m.attachment_url && (
              <button onClick={openAttachment}
                className={`flex items-center gap-2 mb-1.5 p-2 rounded-lg ${own ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" : "bg-muted hover:bg-muted/70"}`}>
                <Icon className="h-6 w-6 shrink-0" />
                <div className="min-w-0 text-start">
                  <p className="text-xs font-semibold truncate">{m.attachment_name ?? "مرفق"}</p>
                  <p className="text-[10px] opacity-70">{humanSize(m.attachment_size)}</p>
                </div>
                <Download className="h-4 w-4 shrink-0 ms-1" />
              </button>
            )}
            {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
          </>
        )}

        <div className={`flex items-center gap-1 mt-1 text-[10px] ${own ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          <span>{formatChatDetailedTime(m.created_at)}</span>
          {own && (
            m.read_at ? <CheckCheck className="h-3 w-3 text-sky-300" />
            : m.delivered_at ? <CheckCheck className="h-3 w-3" />
            : <Check className="h-3 w-3" />
          )}
        </div>

        {!m.deleted_at && (
          <div className={`absolute -top-2 ${own ? "left-1" : "right-1"} opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity`}>
            {onReply && (
              <Button size="icon" variant="secondary" className="h-6 w-6 rounded-full shadow" onClick={() => onReply(m)}>
                <Reply className="h-3 w-3" />
              </Button>
            )}
            {own && onDelete && (
              <Button size="icon" variant="destructive" className="h-6 w-6 rounded-full shadow" onClick={() => onDelete(m)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function useSignedUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    supabase.storage.from("chat-files").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled && data) setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function AttachmentImage({ m }: { m: any }) {
  const url = useSignedUrl(m.attachment_url);
  return url
    ? <img src={url} alt={m.attachment_name ?? ""} loading="lazy" className="max-h-64 object-cover w-full" />
    : <div className="h-32 w-64 bg-muted animate-pulse" />;
}

function AttachmentAudio({ m }: { m: any }) {
  const url = useSignedUrl(m.attachment_url);
  return url ? <audio src={url} controls className="max-w-full" /> : <div className="h-10 w-56 bg-muted animate-pulse rounded" />;
}

function AttachmentVideo({ m }: { m: any }) {
  const url = useSignedUrl(m.attachment_url);
  return url
    ? <video src={url} controls className="max-h-64 w-full rounded" />
    : <div className="h-40 w-64 bg-muted animate-pulse rounded" />;
}
