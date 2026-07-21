import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Users, GraduationCap, Ban, CheckCircle2, Edit, Eye, Trash2, MoreHorizontal, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import type { StudentRow } from "@/lib/students-utils";

interface Props {
  students: StudentRow[];
  isLoading: boolean;
  onEdit: (s: StudentRow) => void;
  onDelete: (ids: string[]) => void;
  onToggleStatus: (ids: string[], status: "active" | "suspended") => void;
}

type GroupBucket = { id: string; name: string; students: StudentRow[] };
type ClassBucket = { id: string; name: string; groups: GroupBucket[]; total: number };

const NO_CLASS = "__no_class__";
const NO_GROUP = "__no_group__";
const PREVIEW_COUNT = 5;

export function StudentsGroupedView({ students, isLoading, onEdit, onDelete, onToggleStatus }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<{ classId: string; groupId: string; name: string } | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return students;
    return students.filter((st) =>
      st.full_name.toLowerCase().includes(s) ||
      st.code.toLowerCase().includes(s) ||
      (st.phone ?? "").toLowerCase().includes(s) ||
      (st.parent_phone ?? "").toLowerCase().includes(s),
    );
  }, [students, search]);

  const buckets: ClassBucket[] = useMemo(() => {
    const map = new Map<string, ClassBucket>();
    for (const st of filtered) {
      const cId = st.class_id ?? NO_CLASS;
      const cName = st.classes?.name ?? "بدون صف";
      const gId = st.group_id ?? NO_GROUP;
      const gName = st.groups?.name ?? "بدون مجموعة";

      let cls = map.get(cId);
      if (!cls) {
        cls = { id: cId, name: cName, groups: [], total: 0 };
        map.set(cId, cls);
      }
      let grp = cls.groups.find((g) => g.id === gId);
      if (!grp) {
        grp = { id: gId, name: gName, students: [] };
        cls.groups.push(grp);
      }
      grp.students.push(st);
      cls.total++;
    }
    // sort: real classes first (alpha), then "no class"; groups alpha too
    const arr = [...map.values()];
    arr.sort((a, b) => {
      if (a.id === NO_CLASS) return 1;
      if (b.id === NO_CLASS) return -1;
      return a.name.localeCompare(b.name, "ar");
    });
    for (const c of arr) {
      c.groups.sort((a, b) => {
        if (a.id === NO_GROUP) return 1;
        if (b.id === NO_GROUP) return -1;
        return a.name.localeCompare(b.name, "ar");
      });
      for (const g of c.groups) {
        g.students.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
      }
    }
    return arr;
  }, [filtered]);

  if (isLoading) {
    return (
      <Card><CardContent className="py-16 text-center text-muted-foreground">جارٍ تحميل الطلاب...</CardContent></Card>
    );
  }

  if (students.length === 0) {
    return (
      <Card><CardContent className="py-16 text-center text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
        لا يوجد طلاب بعد. ابدأ بإضافة طالب من الأعلى.
      </CardContent></Card>
    );
  }

  const defaultOpen = buckets.slice(0, 2).map((c) => c.id);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث سريعًا في كل الصفوف والمجموعات..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {buckets.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">لا نتائج مطابقة للبحث</CardContent></Card>
      ) : (
        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-3">
          {buckets.map((cls) => (
            <AccordionItem key={cls.id} value={cls.id} className="border rounded-xl bg-card shadow-sm overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40">
                <div className="flex items-center gap-3 flex-1 text-right">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base truncate">{cls.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {cls.groups.length} مجموعة • {cls.total} طالب
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 px-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {cls.groups.map((grp) => (
                    <GroupCard
                      key={grp.id}
                      group={grp}
                      onExpand={() => setExpanded({ classId: cls.id, groupId: grp.id, name: `${cls.name} — ${grp.name}` })}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onToggleStatus={onToggleStatus}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={!!expanded} onOpenChange={(o) => !o && setExpanded(null)}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{expanded?.name}</DialogTitle>
          </DialogHeader>
          {expanded && (
            <div className="space-y-2">
              {(buckets.find((c) => c.id === expanded.classId)?.groups.find((g) => g.id === expanded.groupId)?.students ?? []).map((s) => (
                <StudentRowItem
                  key={s.id}
                  s={s}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleStatus={onToggleStatus}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupCard({
  group, onExpand, onEdit, onDelete, onToggleStatus,
}: {
  group: GroupBucket;
  onExpand: () => void;
  onEdit: (s: StudentRow) => void;
  onDelete: (ids: string[]) => void;
  onToggleStatus: (ids: string[], status: "active" | "suspended") => void;
}) {
  const preview = group.students.slice(0, PREVIEW_COUNT);
  const rest = group.students.length - preview.length;
  return (
    <Card className="border-2 border-primary/10 hover:border-primary/30 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="truncate">{group.name}</span>
          <Badge variant="secondary" className="shrink-0">{group.students.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-1.5">
        {preview.map((s) => (
          <StudentRowItem key={s.id} s={s} compact onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} />
        ))}
        {rest > 0 && (
          <Button variant="ghost" size="sm" className="w-full text-primary" onClick={onExpand}>
            عرض الكل ({rest}+)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StudentRowItem({
  s, compact, onEdit, onDelete, onToggleStatus,
}: {
  s: StudentRow;
  compact?: boolean;
  onEdit: (s: StudentRow) => void;
  onDelete: (ids: string[]) => void;
  onToggleStatus: (ids: string[], status: "active" | "suspended") => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
      <Avatar className={compact ? "h-7 w-7" : "h-9 w-9"}>
        <AvatarImage src={s.avatar_url ?? undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{s.full_name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <Link to="/admin/students/$id" params={{ id: s.id }} className="text-sm font-medium hover:underline truncate block">
          {s.full_name}
        </Link>
        <div className="text-[11px] text-muted-foreground font-mono truncate" dir="ltr">{s.code}</div>
      </div>
      {s.status === "suspended" && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">موقوف</Badge>}
      {s.parent_whatsapp && (
        <WhatsAppButton
          phone={s.parent_whatsapp}
          template="wa.tpl.student_card"
          vars={{
            name: s.full_name,
            code: s.code,
            grade: s.classes?.name ?? "—",
            class: s.groups?.name ?? "—",
          }}
          size="icon"
          variant="ghost"
          className="h-7 w-7"
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="خيارات الطالب">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/admin/students/$id" params={{ id: s.id }}><Eye className="h-4 w-4 ml-2" />عرض الكارت</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(s)}>
            <Edit className="h-4 w-4 ml-2" />تعديل
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onToggleStatus([s.id], s.status === "active" ? "suspended" : "active")}>
            {s.status === "active" ? <><Ban className="h-4 w-4 ml-2" />إيقاف</> : <><CheckCircle2 className="h-4 w-4 ml-2" />تفعيل</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete([s.id])}>
            <Trash2 className="h-4 w-4 ml-2" />حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
