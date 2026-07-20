import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/admin/classes")({
  head: () => ({ meta: [{ title: "الفصول — لوحة المدرس" }] }),
  component: () => <PagePlaceholder title="الفصول" description="إدارة الفصول والمجموعات" icon={GraduationCap} />,
});
