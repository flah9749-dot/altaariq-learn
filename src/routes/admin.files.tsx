import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/admin/files")({
  head: () => ({ meta: [{ title: "الملفات — لوحة المدرس" }] }),
  component: () => <PagePlaceholder title="الملفات" description="مكتبة الملفات والموارد التعليمية" icon={FolderOpen} />,
});
