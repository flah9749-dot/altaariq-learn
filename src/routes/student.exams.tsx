import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/student/exams")({
  head: () => ({ meta: [{ title: "امتحاناتي — الطارق التعليمية" }] }),
  component: ExamsLayout,
});

function ExamsLayout() {
  return <Outlet />;
}
