import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Paperclip, Send, Smile, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { compressImage, EMOJIS, fileIconFor, humanSize, isImageMime } from "@/lib/message-utils";

interface Props {
  onSend: (payload: {
    body: string;
    attachment?: { url: string; name: string; mime: string; size: number };
    message_type: "text" | "image" | "file" | "audio" | "video";
    reply_to?: string | null;
  }) => Promise<void> | void;
  replyTo?: any | null;
  onClearReply?: () => void;
  onOpenCamera?: () => void;
  disabled?: boolean;
}

export function MessageComposer({ onSend, replyTo, onClearReply, onOpenCamera, disabled }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [staged, setStaged] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const over = (e: DragEvent) => { e.preventDefault(); el.classList.add("ring-2","ring-primary"); };
    const leave = () => el.classList.remove("ring-2","ring-primary");
    const drop = (e: DragEvent) => {
      e.preventDefault(); leave();
      const f = e.dataTransfer?.files?.[0]; if (f) setStaged(f);
    };
    el.addEventListener("dragover", over); el.addEventListener("dragleave", leave); el.addEventListener("drop", drop);
    return () => { el.removeEventListener("dragover", over); el.removeEventListener("dragleave", leave); el.removeEventListener("drop", drop); };
  }, []);

  const uploadToChatBucket = async (file: File | Blob, name: string, mime: string): Promise<{ path: string; size: number }> => {
    const ext = name.includes(".") ? name.split(".").pop() : "";
    const key = `${user!.id}/${Date.now()}-${crypto.randomUUID()}${ext ? "." + ext : ""}`;
    setUploadPct(15);
    const { error } = await supabase.storage.from("chat-files").upload(key, file, {
      contentType: mime, cacheControl: "3600", upsert: false,
    });
    setUploadPct(100);
    if (error) throw new Error(error.message);
    return { path: key, size: (file as any).size ?? 0 };
  };

  const handleSend = async () => {
    if (disabled || pending) return;
    const body = text.trim();
    if (!body && !staged) return;
    setPending(true);
    try {
      let attachment: any = undefined;
      let type: "text" | "image" | "file" | "audio" | "video" = "text";
      if (staged) {
        const mime = staged.type || "application/octet-stream";
        let toUpload: File | Blob = staged;
        if (isImageMime(mime)) {
          toUpload = await compressImage(staged);
          type = "image";
        } else if (mime.startsWith("audio/")) type = "audio";
        else if (mime.startsWith("video/")) type = "video";
        else type = "file";
        const { path, size } = await uploadToChatBucket(toUpload, staged.name, mime);
        attachment = { url: path, name: staged.name, mime, size };
      }
      await onSend({ body, attachment, message_type: type, reply_to: replyTo?.id ?? null });
      setText(""); setStaged(null); setUploadPct(null);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الإرسال");
      setUploadPct(null);
    } finally { setPending(false); }
  };

  const Icon = staged ? fileIconFor(staged.type) : null;

  return (
    <div ref={dropRef} className="border-t bg-background p-2 md:p-3 space-y-2 shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {replyTo && (
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2 text-xs">
          <span className="me-auto truncate">↩️ رد على: {replyTo.body?.slice(0, 60) ?? "مرفق"}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClearReply} aria-label="إلغاء الرد"><X className="h-3 w-3"/></Button>
        </div>
      )}
      {staged && Icon && (
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2 text-xs">
          {isImageMime(staged.type) ? <ImageIcon className="h-4 w-4"/> : <Icon className="h-4 w-4" />}
          <span className="truncate flex-1">{staged.name}</span>
          <span className="text-muted-foreground">{humanSize(staged.size)}</span>
          {uploadPct != null && <span className="text-primary">{uploadPct}%</span>}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setStaged(null)}><X className="h-3 w-3"/></Button>
        </div>
      )}
      <div className="flex items-end gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" title="إيموجي"><Smile className="h-5 w-5"/></Button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-72 p-2" dir="rtl">
            <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto">
              {EMOJIS.map((e) => (
                <button key={e} type="button" className="text-2xl hover:bg-muted rounded p-1"
                  onClick={() => setText((t) => t + e)}>{e}</button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" title="إرفاق ملف" onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-5 w-5"/>
        </Button>
        {onOpenCamera && (
          <Button variant="ghost" size="icon" title="كاميرا" onClick={onOpenCamera}>
            <Camera className="h-5 w-5"/>
          </Button>
        )}
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; if (f) setStaged(f); e.target.value = "";
        }} />
        <Textarea
          placeholder="اكتب رسالتك..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          rows={1}
          className="resize-none min-h-[42px] max-h-32 flex-1 text-base md:text-sm"
          disabled={disabled}
        />
        <Button onClick={handleSend} size="icon" disabled={disabled || pending || (!text.trim() && !staged)}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
        </Button>
      </div>
    </div>
  );
}
