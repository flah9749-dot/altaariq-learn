import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("مسموح للأدمن فقط");
}

const VideoInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().max(2000).nullable().optional(),
  class_id: z.string().uuid().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
  term: z.string().max(120).nullable().optional(),
  unit: z.string().max(120).nullable().optional(),
  lesson: z.string().max(120).nullable().optional(),
  provider: z.enum(["upload", "youtube", "bunny", "cloudflare", "url"]).default("upload"),
  source_url: z.string().max(2000).nullable().optional(),
  storage_path: z.string().max(500).nullable().optional(),
  thumbnail_url: z.string().max(2000).nullable().optional(),
  duration_sec: z.number().int().min(0).default(0),
  access_type: z.enum(["free", "paid", "hidden", "scheduled"]).default("free"),
  publish_at: z.string().nullable().optional(),
  access_expires_at: z.string().nullable().optional(),
  notify: z.boolean().default(false),
});

export const upsertVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VideoInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notify, id, ...payload } = data;

    if (id) {
      const { error } = await supabaseAdmin.from("videos").update(payload as any).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("videos")
      .insert({ ...(payload as any), created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (notify && payload.access_type !== "hidden") {
      try {
        const { notifyStudents } = await import("./notify-helpers.server");
        await notifyStudents({
          title: "🎬 فيديو جديد",
          body: payload.title,
          type: "video",
          link: "/student/videos",
          target: payload.group_id
            ? { kind: "group", group_id: payload.group_id }
            : payload.class_id
              ? { kind: "class", class_id: payload.class_id }
              : { kind: "all" },
        });
      } catch {}
    }
    return { id: row!.id };
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: v } = await supabaseAdmin.from("videos").select("storage_path").eq("id", data.id).maybeSingle();
    if (v?.storage_path) await supabaseAdmin.storage.from("videos").remove([v.storage_path]).catch(() => {});
    const { error } = await supabaseAdmin.from("videos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Server-side gate: verifies access, then returns a short-lived playback URL. */
export const getVideoPlayback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: rpcErr } = await context.supabase.rpc("can_watch_video", { _video_id: data.id });
    if (rpcErr) throw new Error(rpcErr.message);
    if (!allowed) throw new Error("هذا الفيديو غير متاح لك");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: v, error } = await supabaseAdmin
      .from("videos")
      .select("id,title,provider,source_url,storage_path,duration_sec")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !v) throw new Error("الفيديو غير موجود");

    let url = v.source_url ?? "";
    if (v.provider === "upload") {
      if (!v.storage_path) throw new Error("ملف الفيديو غير موجود");
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from("videos")
        .createSignedUrl(v.storage_path, 60 * 60 * 3);
      if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "تعذر توليد رابط التشغيل");
      url = signed.signedUrl;
    }

    await supabaseAdmin
      .from("videos")
      .update({ views_count: ((v as any).views_count ?? 0) + 1 } as any)
      .eq("id", v.id)
      .then(() => undefined, () => undefined);

    return { id: v.id, provider: v.provider, url, duration_sec: v.duration_sec ?? 0 };
  });

export const saveVideoProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        video_id: z.string().uuid(),
        position_sec: z.number().int().min(0).max(60 * 60 * 24),
        duration_sec: z.number().int().min(0).max(60 * 60 * 24),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("can_watch_video", { _video_id: data.video_id });
    if (!allowed) throw new Error("غير مصرح");

    const { data: me } = await context.supabase.from("students").select("id").eq("user_id", context.userId).maybeSingle();
    if (!me?.id) return { ok: true };

    const dur = data.duration_sec || 0;
    const percent = dur > 0 ? Math.min(100, Math.round((data.position_sec / dur) * 100)) : 0;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("video_progress")
      .select("id,percent,views,completed")
      .eq("video_id", data.video_id)
      .eq("student_id", me.id)
      .maybeSingle();

    const bestPercent = Math.max(percent, Number(prev?.percent ?? 0));
    const row = {
      video_id: data.video_id,
      student_id: me.id,
      position_sec: data.position_sec,
      watched_sec: data.position_sec,
      percent: bestPercent,
      completed: bestPercent >= 90 || prev?.completed === true,
      views: (prev?.views ?? 0) + (prev ? 0 : 1),
      last_watched_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("video_progress").upsert(row as any, { onConflict: "video_id,student_id" });
    if (error) throw new Error(error.message);
    return { ok: true, percent: bestPercent };
  });

/** Admin: aggregated stats per video + per-student rows for one video. */
export const getVideoStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("video_progress")
      .select("percent,completed,last_watched_at,position_sec,views,students(id,full_name,code)")
      .eq("video_id", data.id)
      .order("last_watched_at", { ascending: false });

    const list = (rows ?? []) as any[];
    const watchers = list.length;
    const completed = list.filter((r) => r.completed).length;
    const avg = watchers ? Math.round(list.reduce((s, r) => s + Number(r.percent ?? 0), 0) / watchers) : 0;
    const views = list.reduce((s, r) => s + Number(r.views ?? 0), 0);
    return { watchers, completed, avgPercent: avg, views, students: list };
  });

export const grantVideoAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        video_id: z.string().uuid(),
        scope: z.enum(["student", "group", "class", "all"]),
        student_id: z.string().uuid().nullable().optional(),
        class_id: z.string().uuid().nullable().optional(),
        group_id: z.string().uuid().nullable().optional(),
        expires_at: z.string().nullable().optional(),
        notes: z.string().max(300).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("video_access_grants")
      .insert({ ...(data as any), created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeVideoAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("video_access_grants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addVideoAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        video_id: z.string().uuid(),
        name: z.string().min(1),
        url: z.string().min(1),
        kind: z.string().default("file"),
        size: z.number().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("video_attachments").insert(data as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVideoAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("video_attachments").delete().eq("id", data.id);
    return { ok: true };
  });

/** Signed URL for an attachment stored in the private "videos" bucket. */
export const getVideoAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin.from("video_attachments").select("video_id,url").eq("id", data.id).maybeSingle();
    if (!a) throw new Error("المرفق غير موجود");
    const { data: allowed } = await context.supabase.rpc("can_watch_video", { _video_id: a.video_id });
    if (!allowed) throw new Error("غير مصرح");
    if (/^https?:\/\//i.test(a.url)) return { url: a.url };
    const { data: signed, error } = await supabaseAdmin.storage.from("videos").createSignedUrl(a.url, 3600);
    if (error || !signed?.signedUrl) throw new Error("تعذر توليد الرابط");
    return { url: signed.signedUrl };
  });
