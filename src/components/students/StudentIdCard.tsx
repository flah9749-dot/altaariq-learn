import { QRCodeSVG } from "qrcode.react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { StudentRow } from "@/lib/students-utils";

export function StudentIdCard({ student, origin }: { student: StudentRow; origin?: string }) {
  const url = `${origin ?? (typeof window !== "undefined" ? window.location.origin : "")}/admin/students/${student.id}`;
  return (
    <div className="w-[340px] rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-primary to-primary/90 p-5 text-primary-foreground shadow-xl print:shadow-none">
      <div className="flex items-center justify-between border-b border-white/20 pb-3">
        <div>
          <p className="text-xs opacity-80">منصة</p>
          <p className="font-bold text-lg">الطارق التعليمية</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-gold flex items-center justify-center text-primary font-bold">ط</div>
      </div>
      <div className="flex flex-col items-center mt-4 gap-2">
        <Avatar className="h-24 w-24 border-4 border-gold">
          <AvatarImage src={student.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gold text-primary text-xl">{student.full_name.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <h3 className="font-bold text-xl mt-1">{student.full_name}</h3>
        <div className="text-xs bg-white/10 rounded-full px-3 py-1">كود: {student.code}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
        <div className="bg-white/10 rounded-lg p-2">
          <p className="opacity-70">الصف</p>
          <p className="font-semibold">{student.classes?.name ?? "—"}</p>
        </div>
        <div className="bg-white/10 rounded-lg p-2">
          <p className="opacity-70">المجموعة</p>
          <p className="font-semibold">{student.groups?.name ?? "—"}</p>
        </div>
      </div>
      <div className="flex justify-center mt-4 bg-white p-2 rounded-lg">
        <QRCodeSVG value={url} size={110} />
      </div>
    </div>
  );
}
