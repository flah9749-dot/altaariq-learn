import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/student/messages")({
  head: () => ({ meta: [{ title: "الرسائل — الطالب" }] }),
  component: () => <PagePlaceholder title="الرسائل" description="رسائلك مع المدرس" icon={MessageSquare} />,
});
