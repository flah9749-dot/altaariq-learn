import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function SectionTabs({ items }: { items: { to: string; label: string }[] }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {items.map((it) => {
        const active = pathname === it.to || pathname.startsWith(it.to + "/");
        return (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              active ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
