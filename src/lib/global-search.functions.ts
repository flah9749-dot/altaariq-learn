import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchHit = {
  type: "student" | "exam" | "message" | "announcement" | "reward" | "file";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("مسموح للأدمن فقط");
}

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query;
    const like = `%${q}%`;

    const [students, exams, messages, announcements, rewards, files] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, full_name, code, phone, parent_phone")
        .or(`full_name.ilike.${like},code.ilike.${like},phone.ilike.${like},parent_phone.ilike.${like},parent_name.ilike.${like}`)
        .limit(8),
      supabaseAdmin
        .from("exams")
        .select("id, title, description")
        .or(`title.ilike.${like},description.ilike.${like}`)
        .limit(6),
      supabaseAdmin
        .from("messages")
        .select("id, body, created_at")
        .ilike("body", like)
        .order("created_at", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("announcements")
        .select("id, title, body")
        .or(`title.ilike.${like},body.ilike.${like}`)
        .limit(6),
      supabaseAdmin
        .from("reward_catalog")
        .select("id, name, description")
        .or(`name.ilike.${like},description.ilike.${like}`)
        .limit(6),
      supabaseAdmin
        .from("files")
        .select("id, name, description")
        .or(`name.ilike.${like},description.ilike.${like}`)
        .limit(6),
    ]);

    const hits: SearchHit[] = [];
    for (const s of students.data ?? []) {
      hits.push({
        type: "student",
        id: s.id,
        title: s.full_name,
        subtitle: `كود: ${s.code}${s.phone ? " · " + s.phone : ""}`,
        url: `/admin/students/${s.id}`,
      });
    }
    for (const e of exams.data ?? []) {
      hits.push({
        type: "exam",
        id: e.id,
        title: e.title,
        subtitle: e.description ?? undefined,
        url: `/admin/exams/${e.id}`,
      });
    }
    for (const m of messages.data ?? []) {
      hits.push({
        type: "message",
        id: m.id,
        title: (m.body ?? "").slice(0, 60) || "رسالة",
        subtitle: new Date(m.created_at).toLocaleString("ar-EG"),
        url: `/admin/messages`,
      });
    }
    for (const a of announcements.data ?? []) {
      hits.push({
        type: "announcement",
        id: a.id,
        title: a.title,
        subtitle: (a.body ?? "").slice(0, 60),
        url: `/admin/notifications`,
      });
    }
    for (const r of rewards.data ?? []) {
      hits.push({
        type: "reward",
        id: r.id,
        title: r.name,
        subtitle: r.description ?? undefined,
        url: `/admin/rewards`,
      });
    }
    for (const f of files.data ?? []) {
      hits.push({
        type: "file",
        id: f.id,
        title: f.name,
        subtitle: f.description ?? undefined,
        url: `/admin/files`,
      });
    }

    return { hits };
  });
