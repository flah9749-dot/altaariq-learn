import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "الإشعارات — لوحة المدرس" }] }),
  component: () => <PagePlaceholder title="الإشعارات" description="إدارة الإشعارات المرسلة للطلاب" icon={Bell} />,
});
