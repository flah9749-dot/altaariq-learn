import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";
export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — لوحة المدرس" }] }),
  component: () => <PagePlaceholder title="الإعدادات" description="إعدادات المنصة والحساب" icon={Settings} />,
});
