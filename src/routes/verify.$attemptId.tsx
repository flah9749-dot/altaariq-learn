import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/common/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { formatArabicDateTime } from "@/lib/students-utils";

export const Route = createFileRoute("/verify/$attemptId")({
  head: () => ({
    meta: [
      { title: "التحقق من الشهادة — الطارق التعليمية" },
      { name: "description", content: "صفحة التحقق من صحة شهادات الامتحانات الصادرة من منصة الطارق التعليمية." },
      { property: "og:title", content: "التحقق من الشهادة — الطارق التعليمية" },
      { property: "og:description", content: "تحقق من صحة شهادات الامتحانات بمسح رمز QR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { attemptId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["verify-cert", attemptId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_certificate_verification", { _attempt_id: attemptId });
      return data as any;
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex justify-center"><Logo size={64} /></div>

        <Card className="overflow-hidden border-2">
          <CardContent className="p-8 text-center space-y-6">
            {isLoading ? (
              <Skeleton className="h-64" />
            ) : !data?.valid ? (
              <>
                <ShieldAlert className="h-20 w-20 mx-auto text-destructive" />
                <h1 className="text-2xl font-bold text-destructive">شهادة غير صالحة</h1>
                <p className="text-muted-foreground">لم يتم العثور على هذه الشهادة أو أنها غير معتمدة.</p>
                <p className="text-xs text-muted-foreground font-mono">#{attemptId.slice(0, 8)}</p>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3">
                  <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center">
                    <ShieldCheck className="h-12 w-12 text-success" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold">شهادة موثّقة ✓</h1>
                  <p className="text-sm text-muted-foreground">صادرة من منصة الطارق التعليمية</p>
                </div>

                <div className="border-t border-b py-6 space-y-4">
                  <Row label="اسم الطالب" value={data.student_name} />
                  <Row label="الامتحان" value={data.exam_title} />
                  <Row label="الدرجة" value={`${data.score} / ${data.total}`} />
                  <Row label="النسبة" value={`${data.percentage}%`} highlight />
                  {data.grade && <Row label="التقدير" value={data.grade} />}
                  <Row label="تاريخ الإصدار" value={formatArabicDateTime(data.submitted_at)} />
                </div>

                <div className="flex items-center justify-center gap-2 text-gold">
                  <Trophy className="h-5 w-5" />
                  <span className="font-semibold">
                    {data.approved ? "شهادة معتمدة" : "شهادة مسلّمة (بانتظار الاعتماد النهائي)"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground font-mono">رقم التحقق: {attemptId}</p>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} الطارق التعليمية — الدراسات الاجتماعية
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm sm:text-base">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-bold text-2xl text-primary" : "font-semibold"}>{value}</span>
    </div>
  );
}
