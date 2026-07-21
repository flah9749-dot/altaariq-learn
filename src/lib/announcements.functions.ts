import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("مسموح للأدمن فقط");
}

const Input = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2),
  body: z.string().min(1),
  image_url: z.string().nullable().optional(),
  attachment_url: z.string().nullable().optional(),
  attachment_name: z.string().nullable().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  target_all: z.boolean().default(true),
  target_class_ids: z.array(z.string().uuid()).default([]),
  target_group_ids: z.array(z.string().uuid()).default([]),
  target_student_ids: z.array(z.string().uuid()).default([]),
  starts_at: z.string().default(() => new Date().toISOString()),
  ends_at: z.string().nullable().optional(),
  published: z.boolean().default(true),
});

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...patch } = data;
      await supabaseAdmin.from("announcements").update(patch).eq("id", id);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("announcements").insert({
      ...data, created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    return { ok: true };
  });

// -------- Files center --------
export const upsertFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().default("general"),
    bucket: z.string().default("general"),
    path: z.string().min(1),
    mime_type: z.string().nullable().optional(),
    size: z.number().nullable().optional(),
    is_public: z.boolean().default(true),
    target_class_id: z.string().uuid().nullable().optional(),
    target_group_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { id, ...patch } = data;
      await supabaseAdmin.from("files").update(patch).eq("id", id);
      return { id };
    }
    const { data: row } = await supabaseAdmin.from("files").insert({
      ...data, owner_id: context.userId,
    }).select("id").single();
    return { id: row!.id };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: f } = await supabaseAdmin.from("files").select("bucket,path").eq("id", data.id).maybeSingle();
    if (f) await supabaseAdmin.storage.from(f.bucket).remove([f.path]).catch(() => {});
    await supabaseAdmin.from("files").delete().eq("id", data.id);
    return { ok: true };
  });

export const getFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    // Use admin client to look up + sign, so students (whose storage.objects RLS
    // may not grant SELECT on the private "general" bucket) can still download
    // files that the app-level `files` policy exposes to them.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: f } = await supabaseAdmin.from("files").select("bucket,path,download_count").eq("id", data.id).maybeSingle();
    if (!f) throw new Error("الملف غير موجود");
    const { data: signed, error } = await supabaseAdmin.storage.from(f.bucket).createSignedUrl(f.path, 3600);
    if (error || !signed?.signedUrl) throw new Error(error?.message ?? "تعذر توليد رابط التنزيل");
    await supabaseAdmin.from("files").update({ download_count: (f.download_count ?? 0) + 1 }).eq("id", data.id);
    return { url: signed.signedUrl };
  });


// -------- Notifications broadcast --------
export const broadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    link: z.string().nullable().optional(),
    type: z.string().default("general"),
    target: z.enum(["all", "class", "group", "students"]).default("all"),
    class_id: z.string().uuid().nullable().optional(),
    group_id: z.string().uuid().nullable().optional(),
    student_ids: z.array(z.string().uuid()).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("students").select("user_id").not("user_id", "is", null).eq("status", "active");
    if (data.target === "class" && data.class_id) q = q.eq("class_id", data.class_id);
    else if (data.target === "group" && data.group_id) q = q.eq("group_id", data.group_id);
    else if (data.target === "students") q = q.in("id", data.student_ids);
    const { data: rows } = await q;
    const recipients = (rows ?? []).map((r: any) => r.user_id).filter(Boolean);
    if (!recipients.length) return { count: 0 };
    await supabaseAdmin.from("notifications").insert(
      recipients.map((uid: string) => ({
        user_id: uid, title: data.title, body: data.body, type: data.type, link: data.link ?? null,
      })),
    );
    return { count: recipients.length };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.all) {
      await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    } else if (data.id) {
      await supabase.from("notifications").update({ read: true }).eq("id", data.id);
    }
    return { ok: true };
  });
