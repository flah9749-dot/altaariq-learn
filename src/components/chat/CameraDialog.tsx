import { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, Send, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraDialog({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("environment");

  const start = async () => {
    setSnapshot(null); setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setReady(true); }
    } catch (e: any) {
      toast.error("تعذر الوصول للكاميرا: " + (e?.message ?? ""));
      onClose();
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (open) start(); else { stop(); setSnapshot(null); }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  const takeShot = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.9));
  };

  const send = async () => {
    if (!snapshot) return;
    const res = await fetch(snapshot);
    const blob = await res.blob();
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5"/>الكاميرا</DialogTitle></DialogHeader>
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          {snapshot ? <img src={snapshot} alt="لقطة" className="w-full h-full object-contain" />
            : <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />}
          {!ready && !snapshot && <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="h-8 w-8 animate-spin"/></div>}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => setFacing((f) => f === "user" ? "environment" : "user")}>
            <RefreshCw className="h-4 w-4 ml-1"/>تبديل الكاميرا
          </Button>
          {snapshot ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setSnapshot(null); start(); }}><X className="h-4 w-4 ml-1"/>إعادة</Button>
              <Button onClick={send}><Send className="h-4 w-4 ml-1"/>إرسال</Button>
            </div>
          ) : (
            <Button onClick={takeShot} disabled={!ready}><Camera className="h-4 w-4 ml-1"/>التقاط</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
