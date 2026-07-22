import { QRCodeSVG } from "qrcode.react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { StudentRow } from "@/lib/students-utils";

interface Props {
  student: StudentRow;
  origin?: string;
  password?: string | null;
  platformUrl?: string;
}

// Fixed high-contrast palette (independent of theme tokens for print reliability)
const NAVY = "#0B1E3F";
const NAVY_SOFT = "#132A55";
const GOLD_LIGHT = "#F3D57A";
const GOLD = "#D4A537";
const GOLD_DARK = "#8A6420";
const CREAM = "#FFF8E6";

export function StudentIdCard({ student, origin, password, platformUrl }: Props) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const url = `${base}/admin/students/quick/${student.code}`;
  const siteLabel = (platformUrl ?? base).replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div
      className="relative w-[360px] overflow-hidden rounded-3xl p-0 shadow-2xl print:shadow-none"
      style={{
        background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 55%, ${GOLD_DARK} 100%)`,
        color: NAVY,
        border: `2px solid ${GOLD_DARK}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3"
        style={{ borderBottom: `1px solid ${GOLD_DARK}` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black"
            style={{ background: NAVY, color: GOLD_LIGHT }}
          >
            ط
          </div>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold" style={{ color: NAVY }}>منصة</p>
            <p className="text-base font-extrabold tracking-tight" style={{ color: NAVY }}>
              الطارق التعليمية
            </p>
          </div>
        </div>
        <div
          className="rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ background: NAVY, color: GOLD_LIGHT }}
        >
          بطاقة طالب
        </div>
      </div>

      {/* Identity */}
      <div className="flex flex-col items-center gap-2 px-5 pt-4">
        <Avatar className="h-24 w-24 border-4" style={{ borderColor: NAVY }}>
          <AvatarImage src={student.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl font-bold" style={{ background: NAVY, color: GOLD_LIGHT }}>
            {student.full_name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <h3
          className="mt-1 text-center text-lg font-extrabold leading-tight"
          style={{ color: NAVY }}
        >
          {student.full_name}
        </h3>
        <div className="flex gap-1.5 text-[11px]">
          <span
            className="rounded-full px-3 py-1 font-bold"
            style={{ background: NAVY, color: GOLD_LIGHT }}
          >
            {student.classes?.name ?? "—"}
          </span>
          <span
            className="rounded-full px-3 py-1 font-bold"
            style={{ background: NAVY_SOFT, color: GOLD_LIGHT }}
          >
            {student.groups?.name ?? "—"}
          </span>
        </div>
      </div>

      {/* Credentials */}
      <div
        className="mx-5 mt-4 rounded-2xl p-3"
        style={{ background: CREAM, border: `1.5px solid ${NAVY}` }}
      >
        <p
          className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest"
          style={{ color: NAVY }}
        >
          بيانات الدخول
        </p>
        <div className="space-y-2">
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: "#ffffff", border: `1px solid ${NAVY}` }}
          >
            <span className="text-[12px] font-bold" style={{ color: NAVY }}>الكود</span>
            <span dir="ltr" className="font-mono text-sm font-black tracking-wider" style={{ color: NAVY }}>
              {student.code}
            </span>
          </div>
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: NAVY, color: GOLD_LIGHT }}
          >
            <span className="text-[12px] font-bold" style={{ color: GOLD_LIGHT }}>كلمة المرور</span>
            <span
              dir="ltr"
              className="font-mono text-base font-black tracking-wider"
              style={{ color: GOLD_LIGHT }}
            >
              {password ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* QR + link */}
      <div className="mt-3 flex items-center gap-3 px-5 pb-4">
        <div className="rounded-xl bg-white p-1.5 shadow" style={{ border: `1.5px solid ${NAVY}` }}>
          <QRCodeSVG value={url} size={72} />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] font-semibold" style={{ color: NAVY }}>ادخل من الموقع</p>
          <p dir="ltr" className="truncate text-[13px] font-black" style={{ color: NAVY }}>
            {siteLabel}
          </p>
          <p className="mt-1 text-[11px] font-semibold" style={{ color: NAVY }}>
            أو امسح الكود بالكاميرا
          </p>
        </div>
      </div>

      {/* Footer strip */}
      <div
        className="px-5 py-2 text-center text-[11px] font-bold"
        style={{ background: NAVY, color: GOLD_LIGHT }}
      >
        احتفظ بالبطاقة — لا تشارك كلمة المرور مع أحد
      </div>
    </div>
  );
}
