import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/student/exams/$id/")({
  component: ExamDetailsRedirect,
});

function ExamDetailsRedirect() {
  const { id } = Route.useParams();
  return <Navigate to="/student/exams/$id/start" params={{ id }} replace />;
}