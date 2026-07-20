import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/admin/exams")({
  head: () => ({ meta: [{ title: "الامتحانات — لوحة المدرس" }] }),
  component: () => <PagePlaceholder title="الامتحانات" description="إنشاء وإدارة الامتحانات والاختبارات" icon={FileText} />,
});
