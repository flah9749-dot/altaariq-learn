import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "التقارير — لوحة المدرس" }] }),
  component: () => <PagePlaceholder title="التقارير" description="تقارير الأداء والإحصائيات" icon={BarChart3} />,
});
