import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAdminScope } from "@/lib/admin-scope";

/**
 * Global scope selector shown in the admin header. Choosing a class/group
 * here filters students, leaderboard, results, reports and any page that
 * reads useAdminScope() — so a teacher juggling 6 classes × 3 groups sees
 * only one bucket at a time without re-selecting on every page.
 */
export function ScopeSelector() {
  const { classId, groupId, setClassId, setGroupId, clear } = useAdminScope();

  const { data: classes } = useQuery({
    queryKey: ["scope-classes"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("name")).data ?? [],
    staleTime: 60_000,
  });
  const { data: groups } = useQuery({
    queryKey: ["scope-groups", classId],
    queryFn: async () => {
      let q = supabase.from("groups").select("id,name,class_id").order("name");
      if (classId) q = q.eq("class_id", classId);
      return (await q).data ?? [];
    },
    enabled: !!classId,
    staleTime: 60_000,
  });

  const active = !!classId || !!groupId;

  return (
    <div className="hidden md:flex items-center gap-1.5">
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 px-1.5 py-1">
        <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
        <Select value={classId ?? "all"} onValueChange={(v) => setClassId(v === "all" ? null : v)}>
          <SelectTrigger className="h-7 w-32 border-0 bg-transparent px-1.5 text-xs focus:ring-0">
            <SelectValue placeholder="كل الصفوف" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الصفوف</SelectItem>
            {(classes ?? []).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground/40">/</span>

        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
        <Select
          value={groupId ?? "all"}
          onValueChange={(v) => setGroupId(v === "all" ? null : v)}
          disabled={!classId}
        >
          <SelectTrigger className="h-7 w-32 border-0 bg-transparent px-1.5 text-xs focus:ring-0 disabled:opacity-60">
            <SelectValue placeholder={classId ? "كل المجموعات" : "اختر صفًا أولًا"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المجموعات</SelectItem>
            {(groups ?? []).map((g: any) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {active && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label="مسح الفلترة"
            onClick={clear}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
