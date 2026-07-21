import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiRequest, jsonResponse } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/public/v1/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [students, exams, attempts] = await Promise.all([
          supabaseAdmin.from("students").select("id", { head: true, count: "exact" }).is("archived_at", null),
          supabaseAdmin.from("exams").select("id", { head: true, count: "exact" }),
          supabaseAdmin.from("exam_attempts").select("id", { head: true, count: "exact" }),
        ]);
        return jsonResponse({
          students: students.count ?? 0,
          exams: exams.count ?? 0,
          attempts: attempts.count ?? 0,
          server_time: new Date().toISOString(),
        });
      },
    },
  },
});
