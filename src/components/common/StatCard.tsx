import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props { title: string; value: string | number; icon: LucideIcon; hint?: string; accent?: "primary" | "gold" | "accent" | "success" | "warning" | "destructive"; }

const ACCENTS: Record<NonNullable<Props["accent"]>, string> = {
  primary: "from-primary/15 to-primary/5 text-primary",
  gold: "from-gold/25 to-gold/5 text-gold-foreground",
  accent: "from-accent/20 to-accent/5 text-accent",
  success: "from-success/20 to-success/5 text-success",
  warning: "from-warning/25 to-warning/5 text-warning-foreground",
  destructive: "from-destructive/15 to-destructive/5 text-destructive",
};

export function StatCard({ title, value, icon: Icon, hint, accent = "primary" }: Props) {
  return (
    <Card className="overflow-hidden border-border/60 transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={`shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${ACCENTS[accent]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
