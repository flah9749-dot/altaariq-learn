import { createFileRoute } from "@tanstack/react-router";
import { Award } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/student/rewards")({
  head: () => ({ meta: [{ title: "الجوائز — الطالب" }] }),
  component: () => <PagePlaceholder title="جوائزي" description="الجوائز والإنجازات" icon={Award} />,
});
