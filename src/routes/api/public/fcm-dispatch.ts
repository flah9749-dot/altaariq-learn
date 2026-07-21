import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/fcm-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-dispatch-secret") ?? "";
        const expected = process.env.PUSH_DISPATCH_SECRET ?? "";
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        let body: { notification_id?: string } = {};
        try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
        const id = body.notification_id;
        if (!id) return new Response("Missing notification_id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: notif } = await supabaseAdmin
          .from("notifications")
          .select("user_id, title, body, link")
          .eq("id", id)
          .maybeSingle();
        if (!notif) return new Response("ok", { status: 200 });

        const { data: tokens } = await supabaseAdmin
          .from("push_tokens")
          .select("token")
          .eq("user_id", notif.user_id);
        const list = (tokens ?? []).map((r: any) => r.token as string).filter(Boolean);
        if (!list.length) return new Response("no-tokens", { status: 200 });

        const { sendFcm } = await import("@/lib/fcm.server");
        const results = await sendFcm(list.map((t) => ({
          token: t,
          title: notif.title,
          body: notif.body ?? "",
          link: notif.link ?? "/",
        })));

        // Prune invalid tokens
        const dead = results.filter((r) => r.invalidToken).map((r) => r.token);
        if (dead.length) {
          await supabaseAdmin.from("push_tokens").delete().in("token", dead);
        }

        return new Response(JSON.stringify({ sent: results.filter((r) => r.ok).length, dead: dead.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
