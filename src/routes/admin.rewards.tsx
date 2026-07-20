import { createFileRoute } from "@tanstack/react-router";
import { Award } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/admin/rewards")({
  head: () => ({ meta: [{ title: "الجوائز — لوحة المدرس" }] }),
  component: () => <PagePlaceholder title="الجوائز" description="نظام الجوائز والنقاط للطلاب" icon={Award} />,
});
