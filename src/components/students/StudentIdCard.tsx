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
      className="relative w-[360px] overflow-hidden rounded-3xl p-0 shadow-2xl print:shadow-none"
      style={{
        background:
          "linear-gradient(135deg, #C9A24B 0%, #E9C878 45%, #B8862F 100%)",
        color: "hsl(var(--primary))",
        border: "2px solid #8A6420",
      }}
    >
      {/* Decorative shine */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-30 blur-2xl"
        style={{ background: "#FFF2C2" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full opacity-25 blur-2xl"
        style={{ background: "hsl(var(--primary))" }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black shadow-inner"
            style={{ background: "hsl(var(--primary))", color: "#E9C878" }}
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
          style={{ background: "hsl(var(--primary))", color: "#E9C878" }}
        >
          بطاقة طالب
        </div>
      </div>

      {/* Identity */}
      <div className="flex flex-col items-center gap-2 px-5 pt-4">
        <Avatar className="h-24 w-24 border-4" style={{ borderColor: "hsl(var(--primary))" }}>
          <AvatarImage src={student.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl" style={{ background: "hsl(var(--primary))", color: "#E9C878" }}>
            {student.full_name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <h3 className="mt-1 text-center text-lg font-bold leading-tight">{student.full_name}</h3>
        <div className="flex gap-1.5 text-[11px]">
          <span
            className="rounded-full px-2.5 py-0.5 font-semibold"
            style={{ background: "hsl(var(--primary))", color: "#E9C878" }}
          >
            {student.classes?.name ?? "—"}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 font-semibold"
            style={{ background: "hsl(var(--primary))", color: "#E9C878" }}
          >
            {student.groups?.name ?? "—"}
          </span>
        </div>
      </div>

      {/* Credentials */}
      <div
        className="mx-5 mt-4 rounded-2xl p-3"
        style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(0,0,0,0.15)" }}
      >
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest opacity-80">
          بيانات الدخول
        </p>
        <div className="space-y-2">
          <div
            className="flex items-center justify-between rounded-lg px-3 py-1.5"
            style={{ background: "#ffffff" }}
          >
            <span className="text-[11px] font-semibold opacity-70">الكود</span>
            <span dir="ltr" className="font-mono text-sm font-bold tracking-wider">{student.code}</span>
          </div>
          <div
            className="flex items-center justify-between rounded-lg px-3 py-1.5"
            style={{ background: "hsl(var(--primary))", color: "#E9C878" }}
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
        <div className="rounded-xl bg-white p-1.5 shadow" style={{ border: "1px solid rgba(0,0,0,0.1)" }}>
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
        style={{ background: "hsl(var(--primary))", color: "#E9C878" }}
      >
        احتفظ بالبطاقة — لا تشارك كلمة المرور مع أحد
      </div>
    </div>
  );
}
