import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

export const getPrimaryAdminPeer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("user_id, full_name")
      .not("user_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.user_id) throw new Error("لم يتم إعداد حساب المدرس بعد");
    return { user_id: data.user_id as string, full_name: (data.full_name as string | null) ?? "المدرس" };
  });

// Returns ALL admin user_ids so the student's chat can aggregate messages
// from any admin account into a single conversation thread.
export const getAllAdminPeerIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = new Set<string>();
    const { data: adminsRows } = await supabaseAdmin
      .from("admins").select("user_id").not("user_id", "is", null);
    (adminsRows ?? []).forEach((r: any) => r.user_id && ids.add(r.user_id as string));
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "admin");
    (roleRows ?? []).forEach((r: any) => r.user_id && ids.add(r.user_id as string));
    return { ids: Array.from(ids) };
  });

// -------- Send message (text or with attachment) --------
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    recipient_id: z.string().uuid(),
    body: z.string().default(""),
    message_type: z.enum(["text", "image", "file", "audio", "video"]).default("text"),
    attachment_url: z.string().nullable().optional(),
    attachment_name: z.string().nullable().optional(),
    attachment_mime: z.string().nullable().optional(),
    attachment_size: z.number().nullable().optional(),
    reply_to: z.string().uuid().nullable().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const senderIsAdmin = await isAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Enforce: student can only message an admin, admin can only message a student
    if (senderIsAdmin) {
      const { data: stu } = await supabaseAdmin.from("students").select("id").eq("user_id", data.recipient_id).maybeSingle();
      if (!stu) throw new Error("لا يمكن الإرسال إلا لطالب مسجّل");
    } else {
      // Use service role to reliably verify the recipient is an admin (bypasses RLS/RPC issues).
      const { data: adminRow } = await supabaseAdmin.from("admins").select("id").eq("user_id", data.recipient_id).maybeSingle();
      const { data: adminRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.recipient_id).eq("role", "admin").maybeSingle();
      if (!adminRow && !adminRole) throw new Error("الطلاب يمكنهم فقط مراسلة المدرس");
    }

    if (!data.body.trim() && !data.attachment_url) throw new Error("رسالة فارغة");

    const { data: row, error } = await supabase.from("messages").insert({
      sender_id: userId,
      recipient_id: data.recipient_id,
      body: data.body,
      message_type: data.message_type,
      attachment_url: data.attachment_url ?? null,
      attachment_name: data.attachment_name ?? null,
      attachment_mime: data.attachment_mime ?? null,
      attachment_size: data.attachment_size ?? null,
      reply_to: data.reply_to ?? null,
      delivered_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// -------- Broadcast (admin only) --------
export const broadcastMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    body: z.string().min(1),
    target: z.enum(["all", "class", "group", "students"]).default("all"),
    class_id: z.string().uuid().nullable().optional(),
    group_id: z.string().uuid().nullable().optional(),
    student_ids: z.array(z.string().uuid()).default([]),
    attachment_url: z.string().nullable().optional(),
    attachment_name: z.string().nullable().optional(),
    attachment_mime: z.string().nullable().optional(),
    message_type: z.enum(["text", "image", "file"]).default("text"),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isAdmin(supabase, userId))) throw new Error("مسموح للأدمن فقط");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin.from("students").select("user_id").not("user_id", "is", null).eq("status", "active");
    if (data.target === "class" && data.class_id) q = q.eq("class_id", data.class_id);
    else if (data.target === "group" && data.group_id) q = q.eq("group_id", data.group_id);
    else if (data.target === "students") q = q.in("id", data.student_ids);
    const { data: rows } = await q;
    const recipients = (rows ?? []).map((r: any) => r.user_id).filter(Boolean);
    if (!recipients.length) return { count: 0 };

    const payload = recipients.map((rid: string) => ({
      sender_id: userId, recipient_id: rid, body: data.body,
      message_type: data.message_type,
      attachment_url: data.attachment_url ?? null,
      attachment_name: data.attachment_name ?? null,
      attachment_mime: data.attachment_mime ?? null,
      delivered_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin.from("messages").insert(payload);
    if (error) throw new Error(error.message);
    return { count: recipients.length };
  });

// -------- Mark thread as read --------
export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    peer_id: z.string().uuid().optional(),
    peer_ids: z.array(z.string().uuid()).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ids = data.peer_ids && data.peer_ids.length ? data.peer_ids : (data.peer_id ? [data.peer_id] : []);
    if (!ids.length) return { ok: true };
    await supabase.from("messages")
      .update({ read: true, read_at: new Date().toISOString() })
      .in("sender_id", ids).eq("recipient_id", userId).eq("read", false);
    return { ok: true };
  });

// -------- Delete message (soft) --------
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("messages")
      .update({ deleted_at: new Date().toISOString(), body: "" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Get signed URL for chat attachment --------
export const getChatFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage.from("chat-files").createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// -------- Templates --------
export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    category: z.string().default("chat"),
    channel: z.enum(["chat", "whatsapp"]).default("chat"),
    body: z.string().min(1),
    variables: z.array(z.string()).default([]),
  }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("مسموح للأدمن فقط");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      await supabaseAdmin.from("message_templates").update({
        name: data.name, category: data.category, channel: data.channel,
        body: data.body, variables: data.variables,
      }).eq("id", data.id);
      return { id: data.id };
    }
    const { data: row } = await supabaseAdmin.from("message_templates").insert({
      name: data.name, category: data.category, channel: data.channel,
      body: data.body, variables: data.variables, created_by: context.userId,
    }).select("id").single();
    return { id: row!.id };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("مسموح للأدمن فقط");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("message_templates").delete().eq("id", data.id);
    return { ok: true };
  });
