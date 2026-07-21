import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Search, Users, FileText, MessageSquare, Bell, Award, FolderOpen,
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { globalSearch, type SearchHit } from "@/lib/global-search.functions";
import { useDebounce } from "@/hooks/use-debounce";

const TYPE_META: Record<SearchHit["type"], { label: string; icon: any }> = {
  student: { label: "الطلاب", icon: Users },
  exam: { label: "الامتحانات", icon: FileText },
  message: { label: "الرسائل", icon: MessageSquare },
  announcement: { label: "الإعلانات", icon: Bell },
  reward: { label: "الجوائز", icon: Award },
  file: { label: "الملفات", icon: FolderOpen },
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const search = useServerFn(globalSearch);
  const debounced = useDebounce(q, 300);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.trim()) { setHits([]); return; }
    setLoading(true);
    search({ data: { query: debounced.trim() } })
      .then((r: any) => { if (!cancelled) setHits(r.hits ?? []); })
      .catch(() => { if (!cancelled) setHits([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, search]);

  const grouped = hits.reduce<Record<string, SearchHit[]>>((acc, h) => {
    (acc[h.type] ??= []).push(h);
    return acc;
  }, {});

  const go = (url: string) => {
    setOpen(false);
    setQ("");
    navigate({ to: url });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-muted-foreground hidden md:inline-flex"
        title="بحث شامل (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        <span>بحث شامل...</span>
        <kbd className="ms-2 text-[10px] font-mono bg-muted rounded px-1.5 py-0.5 border">Ctrl K</kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="md:hidden"
        title="بحث شامل"
      >
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="بحث شامل" description="ابحث في كل بيانات المنصة">
        <CommandInput
          placeholder="ابحث عن طالب، امتحان، رسالة، إعلان..."
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          {loading && <div className="py-6 text-center text-sm text-muted-foreground">جاري البحث...</div>}
          {!loading && q.trim() && hits.length === 0 && <CommandEmpty>لا توجد نتائج</CommandEmpty>}
          {!loading && !q.trim() && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              اكتب لبدء البحث في الطلاب، الامتحانات، الرسائل، الإعلانات، الجوائز، الملفات.
            </div>
          )}
          {Object.entries(grouped).map(([type, list]) => {
            const meta = TYPE_META[type as SearchHit["type"]];
            const Icon = meta.icon;
            return (
              <CommandGroup key={type} heading={meta.label}>
                {list.map((h) => (
                  <CommandItem
                    key={`${h.type}-${h.id}`}
                    value={`${h.type}-${h.id}-${h.title}`}
                    onSelect={() => go(h.url)}
                    className="gap-3"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{h.title}</div>
                      {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
