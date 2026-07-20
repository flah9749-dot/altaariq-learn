import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/admin/messages")({
  head: () => ({ meta: [{ title: "الرسائل — لوحة المدرس" }] }),
  component: () => <PagePlaceholder title="الرسائل" description="التواصل مع الطلاب" icon={MessageSquare} />,
});
