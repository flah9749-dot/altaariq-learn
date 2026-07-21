import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScanLine, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRScanner } from "@/components/common/QRScanner";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/scan")({
  head: () => ({ meta: [{ title: "مسح QR — لوحة المدرس" }] }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const [manual, setManual] = useState("");

  const goToCode = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    // Support both full URLs (…/admin/students/quick/CODE) and bare codes
    let code = text;
    try {
      if (text.startsWith("http")) {
        const u = new URL(text);
        const parts = u.pathname.split("/").filter(Boolean);
        code = parts[parts.length - 1] ?? text;
      }
    } catch { /* keep as-is */ }
    if (!code) { toast.error("كود غير صالح"); return; }
    navigate({ to: "/admin/students/quick/$code", params: { code } });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-primary/10 text-primary"><ScanLine className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">مسح QR الطالب</h1>
          <p className="text-sm text-muted-foreground">وجّه الكاميرا نحو الكود لفتح بيانات الطالب فورًا</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">الكاميرا</CardTitle></CardHeader>
        <CardContent>
          <QRScanner onDetected={goToCode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">أو أدخل الكود يدويًا</CardTitle></CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); goToCode(manual); }}
          >
            <Input
              placeholder="كود الطالب مثل: STD-XXXX1234"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="font-mono"
            />
            <Button type="submit" className="gap-1"><ArrowRight className="h-4 w-4" />فتح</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
