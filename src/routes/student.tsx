import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { StudentHeader } from "@/components/student/StudentHeader";
import { PushEnablePrompt } from "@/components/student/PushEnablePrompt";

export const Route = createFileRoute("/student")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (roleRow?.role !== "student") throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: StudentLayout,
});

function StudentLayout() {
  return (
    <div className="min-h-dvh bg-muted/30 md:pr-64 lg:pr-72" dir="rtl">
      <StudentHeader />
      <main className="mx-auto w-full max-w-6xl px-3 pb-8 pt-4 sm:px-4 md:p-6">
        <PushEnablePrompt />
        <Outlet />
      </main>
    </div>
  );
}

