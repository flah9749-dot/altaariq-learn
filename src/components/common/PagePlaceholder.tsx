import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function PagePlaceholder({ title, description, icon: Icon = Construction }: { title: string; description?: string; icon?: LucideIcon }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Icon className="h-8 w-8" />
          </div>
          <p className="font-semibold">قريبًا</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            هذه الصفحة جزء من الهيكل الأساسي — سيتم بناء وظائفها الكاملة في المراحل القادمة.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
