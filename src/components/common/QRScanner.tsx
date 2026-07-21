import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onDetected: (text: string) => void;
  autoStart?: boolean;
}

/**
 * Camera-based QR scanner using html5-qrcode.
 * Emits the decoded text through onDetected and stops after a successful scan.
 */
export function QRScanner({ onDetected, autoStart = true }: Props) {
  const containerId = "qr-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = async () => {
    try {
      if (scannerRef.current && running) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch { /* ignore */ }
    setRunning(false);
  };

  const start = async () => {
    setError(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          await stop();
          onDetected(decoded);
        },
        () => { /* per-frame decode errors are noise */ },
      );
      setRunning(true);
    } catch (e: any) {
      setError(e?.message ?? "تعذر تشغيل الكاميرا");
      setRunning(false);
    }
  };

  useEffect(() => {
    if (autoStart) start();
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div
        id={containerId}
        className="w-full max-w-md mx-auto aspect-square rounded-2xl overflow-hidden bg-black/80 border-4 border-primary/20"
      />
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      <div className="flex justify-center gap-2">
        {!running ? (
          <Button onClick={start} className="gap-2"><Camera className="h-4 w-4" />تشغيل الكاميرا</Button>
        ) : (
          <Button onClick={stop} variant="outline" className="gap-2"><CameraOff className="h-4 w-4" />إيقاف</Button>
        )}
      </div>
    </div>
  );
}
