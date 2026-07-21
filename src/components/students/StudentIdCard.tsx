import { QRCodeSVG } from "qrcode.react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { StudentRow } from "@/lib/students-utils";

interface Props {
  student: StudentRow;
  origin?: string;
  password?: string | null;
  platformUrl?: string;
}

export function StudentIdCard({ student, origin, password, platformUrl }: Props) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const url = `${base}/admin/students/quick/${student.code}`;
  const siteLabel = (platformUrl ?? base).replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div
      className="relative w-[360px] overflow-hidden rounded-3xl border border-gold/40 p-0 text-primary-foreground shadow-2xl print:shadow-none"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 55%, hsl(var(--primary) / 0.85) 100%)",
      }}
    >
      {/* Decorative shine */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-20 blur-2xl"
        style={{ background: "hsl(var(--gold))" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full opacity-10 blur-2xl"
        style={{ background: "hsl(var(--gold))" }}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/15 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black shadow-inner"
            style={{ background: "hsl(var(--gold))", color: "hsl(var(--primary))" }}
          >
            ط
          </div>
          <div className="leading-tight">
            <p className="text-[10px] opacity-80">منصة</p>
            <p className="text-base font-extrabold tracking-tight">الطارق التعليمية</p>
          </div>
        </div>
        <div
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
          style={{ background: "hsl(var(--gold))", color: "hsl(var(--primary))" }}
        >
          بطاقة طالب
        </div>
      </div>

      {/* Identity */}
      <div className="flex flex-col items-center gap-2 px-5 pt-4">
        <Avatar className="h-24 w-24 border-4" style={{ borderColor: "hsl(var(--gold))" }}>
          <AvatarImage src={student.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl" style={{ background: "hsl(var(--gold))", color: "hsl(var(--primary))" }}>
            {student.full_name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <h3 className="mt-1 text-center text-lg font-bold leading-tight">{student.full_name}</h3>
        <div className="flex gap-1.5 text-[11px]">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5">{student.classes?.name ?? "—"}</span>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5">{student.groups?.name ?? "—"}</span>
        </div>
      </div>

      {/* Credentials */}
      <div className="mx-5 mt-4 rounded-2xl border border-white/15 bg-white/10 p-3">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest opacity-80">
          بيانات الدخول
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-white/95 px-3 py-1.5 text-primary">
            <span className="text-[11px] font-semibold opacity-70">الكود</span>
            <span dir="ltr" className="font-mono text-sm font-bold tracking-wider">{student.code}</span>
          </div>
          <div
            className="flex items-center justify-between rounded-lg px-3 py-1.5"
            style={{ background: "hsl(var(--gold))", color: "hsl(var(--primary))" }}
          >
            <span className="text-[11px] font-semibold opacity-80">كلمة المرور</span>
            <span dir="ltr" className="font-mono text-sm font-black tracking-wider">
              {password ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* QR + link */}
      <div className="mt-3 flex items-center gap-3 px-5 pb-4">
        <div className="rounded-xl bg-white p-1.5 shadow">
          <QRCodeSVG value={url} size={72} />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[10px] opacity-80">ادخل من الموقع</p>
          <p dir="ltr" className="truncate text-[13px] font-bold">{siteLabel}</p>
          <p className="mt-1 text-[10px] opacity-80">أو امسح الكود بالكاميرا</p>
        </div>
      </div>

      {/* Footer strip */}
      <div
        className="px-5 py-1.5 text-center text-[10px] font-semibold"
        style={{ background: "hsl(var(--gold))", color: "hsl(var(--primary))" }}
      >
        احتفظ بالبطاقة — لا تشارك كلمة المرور مع أحد
      </div>
    </div>
  );
}
