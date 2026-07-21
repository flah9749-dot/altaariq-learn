import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiRequest, jsonResponse } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/public/v1/leaderboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);

        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("students")
          .select("id, code, full_name, class_id, points, level")
          .is("archived_at", null)
          .order("points", { ascending: false })
          .limit(limit);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data });
      },
    },
  },
});
