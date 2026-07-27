import { memo } from "react";
import { Link } from "@tanstack/react-router";
import {
  MoreHorizontal, Edit, Eye, Ban, CheckCircle2, Trash2, Phone,
  UserCircle2, TrendingUp, CalendarClock, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import type { StudentOverviewRow } from "@/lib/students-overview.functions";

interface Props {
  s: StudentOverviewRow;
  onEdit: (s: StudentOverviewRow) => void;
  onDelete: (ids: string[]) => void;
  onToggleStatus: (ids: string[], status: "active" | "suspended") => void;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return isFinite(d) ? Math.floor(d) : null;
}

function StudentRichCardImpl({ s, onEdit, onDelete, onToggleStatus }: Props) {
  const inactive = daysSince(s.last_seen);
  const isInactive = inactive === null || inactive >= 7;
  const missedLast = s.last_exam_id != null && !s.last_exam_attended;
  const attendanceRate = s.scheduled_count > 0
    ? Math.round((s.attended_count / s.scheduled_count) * 100)
    : null;

  return (
    <Card className="p-3.5 border-2 border-border/60 hover:border-primary/40 hover:shadow-md transition-all bg-card overflow-hidden">
      {/* Header row: avatar + name + status */}
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 shrink-0 ring-2 ring-primary/10">
          <AvatarImage src={s.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
            {s.full_name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Link
            to="/admin/students/$id"
            params={{ id: s.id }}
            className="font-bold text-sm hover:text-primary hover:underline block truncate"
          >
            {s.full_name}
          </Link>
          <div className="text-[11px] text-muted-foreground font-mono truncate" dir="ltr">
            {s.code}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="خيارات">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/admin/students/$id" params={{ id: s.id }}>
                <Eye className="h-4 w-4 ml-2" />ملف الطالب
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(s)}>
              <Edit className="h-4 w-4 ml-2" />تعديل
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onToggleStatus([s.id], s.status === "active" ? "suspended" : "active")}
            >
              {s.status === "active"
                ? <><Ban className="h-4 w-4 ml-2" />إيقاف</>
                : <><CheckCircle2 className="h-4 w-4 ml-2" />تفعيل</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete([s.id])}>
              <Trash2 className="h-4 w-4 ml-2" />حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-1 mt-2">
        {s.status === "active" ? (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0 hover:bg-emerald-500/15">
            نشط
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">موقوف</Badge>
        )}
        {missedLast && (
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 text-[10px] px-1.5 py-0 hover:bg-red-500/15">
            <AlertTriangle className="h-3 w-3 ml-0.5" /> غاب عن آخر امتحان
          </Badge>
        )}
        {isInactive && s.status === "active" && (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30 text-[10px] px-1.5 py-0 hover:bg-slate-500/15">
            <CalendarClock className="h-3 w-3 ml-0.5" />
            {inactive == null ? "لم يدخل بعد" : `غير نشط ${inactive}ي`}
          </Badge>
        )}
      </div>

      {/* Contact row */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="flex items-center gap-1 min-w-0 text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          <span className="truncate" dir="ltr">{s.phone ?? "—"}</span>
        </div>
        <div className="flex items-center gap-1 min-w-0 text-muted-foreground">
          <UserCircle2 className="h-3 w-3 shrink-0" />
          <span className="truncate" dir="ltr">{s.parent_phone ?? "—"}</span>
        </div>
      </div>

      {/* Exam stats grid */}
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <StatMini label="امتحانات" value={s.scheduled_count} color="primary" />
        <StatMini label="حضر" value={s.attended_count} color="success" />
        <StatMini label="غاب" value={s.absent_count} color="danger" />
      </div>

      {/* Last exam + average */}
      <div className="mt-2.5 rounded-lg bg-muted/40 px-2.5 py-2 space-y-1">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground shrink-0">آخر امتحان:</span>
          {s.last_exam_title ? (
            <span className="truncate font-medium text-right">{s.last_exam_title}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground shrink-0">النتيجة:</span>
          {s.last_exam_id == null ? (
            <span className="text-muted-foreground">—</span>
          ) : s.last_exam_attended && s.last_exam_percentage != null ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0 hover:bg-emerald-500/15">
              ✅ {Math.round(Number(s.last_exam_percentage))}%
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">❌ غائب</Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground shrink-0 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            المتوسط:
          </span>
          <span className="font-bold text-primary">
            {s.attended_count > 0 ? `${Math.round(Number(s.avg_percentage))}%` : "—"}
          </span>
        </div>
        {attendanceRate !== null && (
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground shrink-0">الالتزام:</span>
            <span className={
              attendanceRate >= 80 ? "font-bold text-emerald-600" :
              attendanceRate >= 50 ? "font-bold text-amber-600" :
              "font-bold text-red-600"
            }>
              {attendanceRate}%
            </span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {s.parent_whatsapp && (
        <div className="mt-2.5 flex justify-end">
          <WhatsAppButton
            phone={s.parent_whatsapp}
            template="wa.tpl.student_card"
            vars={{
              name: s.full_name,
              code: s.code,
              grade: s.class_name ?? "—",
              class: s.group_name ?? "—",
            }}
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
          />
        </div>
      )}
    </Card>
  );
}

function StatMini({ label, value, color }: { label: string; value: number; color: "primary" | "success" | "danger" }) {
  const cls =
    color === "success" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" :
    color === "danger"  ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" :
                          "bg-primary/10 text-primary border-primary/20";
  return (
    <div className={`rounded-md border px-1 py-1.5 ${cls}`}>
      <div className="text-sm font-bold leading-tight">{value}</div>
      <div className="text-[10px] leading-tight opacity-80">{label}</div>
    </div>
  );
}

export const StudentRichCard = memo(StudentRichCardImpl);
