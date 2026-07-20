import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/admin/students")({
  head: () => ({ meta: [{ title: "الطلاب — لوحة المدرس" }] }),
  component: () => <PagePlaceholder title="الطلاب" description="إدارة الطلاب وإضافتهم وربطهم بالفصول" icon={Users} />,
});
