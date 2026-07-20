import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/student/exams")({
  head: () => ({ meta: [{ title: "الامتحانات — الطالب" }] }),
  component: () => <PagePlaceholder title="الامتحانات" description="الامتحانات المتاحة لك" icon={FileText} />,
});
