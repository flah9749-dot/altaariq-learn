import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiRequest, jsonResponse } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/public/v1/students")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);

        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
        const classId = url.searchParams.get("class_id");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("students")
          .select("id, code, full_name, class_id, group_id, points, level, status")
          .is("archived_at", null)
          .order("full_name")
          .limit(limit);
        if (classId) q = q.eq("class_id", classId);
        const { data, error } = await q;
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, count: data?.length ?? 0 });
      },
    },
  },
});
