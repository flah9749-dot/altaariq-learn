import { useMemo, useState, ReactNode } from "react";
import { ChevronDown, Folder, FolderOpen, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * مكوّن شجرة متدرجة موحّد (File-Explorer style)
 * يدعم مستويين (صف → عناصر) أو ثلاثة (صف → مجموعة → عناصر)
 * لا يعرض الأبناء إلا عند فتح الأب (Lazy render)
 */

type Item = Record<string, any>;

type Bucket<T extends Item> = {
  id: string;
  name: string;
  items: T[];
  subBuckets?: Bucket<T>[];
};

export interface HierarchicalTreeProps<T extends Item> {
  items: T[];
  getClassId: (item: T) => string | null | undefined;
  getClassName: (item: T) => string | null | undefined;
  getGroupId?: (item: T) => string | null | undefined;
  getGroupName?: (item: T) => string | null | undefined;
  renderItem: (item: T) => ReactNode;
  renderClassStats?: (items: T[]) => ReactNode;
  renderGroupStats?: (items: T[]) => ReactNode;
  emptyLabel?: string;
  itemsLabel?: (n: number) => string;
  unassignedLabel?: string;
  className?: string;
}

export function HierarchicalTree<T extends Item>({
  items,
  getClassId,
  getClassName,
  getGroupId,
  getGroupName,
  renderItem,
  renderClassStats,
  renderGroupStats,
  emptyLabel = "لا يوجد عناصر",
  itemsLabel = (n) => `${n} عنصر`,
  unassignedLabel = "بدون تصنيف",
  className,
}: HierarchicalTreeProps<T>) {
  const [openClasses, setOpenClasses] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const buckets = useMemo<Bucket<T>[]>(() => {
    const classMap = new Map<string, Bucket<T>>();
    for (const it of items) {
      const cid = getClassId(it) ?? "__none__";
      const cname = getClassName(it) ?? unassignedLabel;
      let cb = classMap.get(cid);
      if (!cb) {
        cb = { id: cid, name: cname, items: [], subBuckets: getGroupId ? [] : undefined };
        classMap.set(cid, cb);
      }
      cb.items.push(it);
      if (getGroupId && cb.subBuckets) {
        const gid = getGroupId(it) ?? "__none__";
        const gname = getGroupName?.(it) ?? unassignedLabel;
        let gb = cb.subBuckets.find((g) => g.id === gid);
        if (!gb) {
          gb = { id: gid, name: gname, items: [] };
          cb.subBuckets.push(gb);
        }
        gb.items.push(it);
      }
    }
    const arr = Array.from(classMap.values());
    arr.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    arr.forEach((c) => c.subBuckets?.sort((a, b) => a.name.localeCompare(b.name, "ar")));
    return arr;
  }, [items, getClassId, getClassName, getGroupId, getGroupName, unassignedLabel]);

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  };

  if (items.length === 0) {
    return (
      <Card className={cn("p-10 text-center text-muted-foreground", className)}>
        <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
        {emptyLabel}
      </Card>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {buckets.map((c) => {
        const isOpen = openClasses.has(c.id);
        return (
          <Card key={c.id} className="overflow-hidden border-primary/10">
            <button
              type="button"
              onClick={() => toggle(openClasses, setOpenClasses, c.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-right"
            >
              <div className="flex items-center gap-3 flex-1">
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !isOpen && "-rotate-90")} />
                {isOpen ? <FolderOpen className="h-5 w-5 text-primary shrink-0" /> : <Folder className="h-5 w-5 text-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base truncate">{c.name}</div>
                  {renderClassStats && <div className="mt-1">{renderClassStats(c.items)}</div>}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">{itemsLabel(c.items.length)}</Badge>
            </button>

            {isOpen && (
              <div className="border-t bg-muted/20">
                {c.subBuckets ? (
                  <div className="p-2 space-y-2">
                    {c.subBuckets.map((g) => {
                      const gKey = `${c.id}:${g.id}`;
                      const gOpen = openGroups.has(gKey);
                      return (
                        <div key={gKey} className="border rounded-lg overflow-hidden bg-background">
                          <button
                            type="button"
                            onClick={() => toggle(openGroups, setOpenGroups, gKey)}
                            className="w-full flex items-center justify-between p-3 hover:bg-muted/50 text-right"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !gOpen && "-rotate-90")} />
                              {gOpen ? <FolderOpen className="h-4 w-4 text-secondary shrink-0" /> : <Folder className="h-4 w-4 text-secondary shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{g.name}</div>
                                {renderGroupStats && <div className="mt-0.5">{renderGroupStats(g.items)}</div>}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">{itemsLabel(g.items.length)}</Badge>
                          </button>
                          {gOpen && (
                            <div className="border-t divide-y">
                              {g.items.map((it, idx) => (
                                <div key={idx} className="hover:bg-muted/30">{renderItem(it)}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="divide-y">
                    {c.items.map((it, idx) => (
                      <div key={idx} className="hover:bg-muted/30">{renderItem(it)}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
