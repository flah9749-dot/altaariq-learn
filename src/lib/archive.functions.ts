import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("مسموح للأدمن فقط");
}

async function log(admin: any, actor: string, action: string, meta: Record<string, unknown>) {
  await admin.from("activity_log").insert({ actor_id: actor, action, entity_type: "student", entity_id: null, meta });
}

export const archiveStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1), year: z.string().min(2).max(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("students")
      .update({ archived_at: new Date().toISOString(), archived_year: data.year, status: "suspended" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    await log(supabaseAdmin, context.userId, "archive", { ids: data.ids, year: data.year });
    return { ok: true, count: data.ids.length };
  });

export const restoreStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("students")
      .update({ archived_at: null, archived_year: null, status: "active" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    await log(supabaseAdmin, context.userId, "restore", { ids: data.ids });
    return { ok: true, count: data.ids.length };
  });

export const promoteStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1),
      new_class_id: z.string().uuid().nullable().optional(),
      new_group_id: z.string().uuid().nullable().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { archived_at: null, archived_year: null, status: "active" };
    if (data.new_class_id !== undefined) patch.class_id = data.new_class_id;
    if (data.new_group_id !== undefined) patch.group_id = data.new_group_id;
    const { error } = await supabaseAdmin.from("students").update(patch as any).in("id", data.ids);
    if (error) throw new Error(error.message);
    await log(supabaseAdmin, context.userId, "promote", { ids: data.ids });
    return { ok: true, count: data.ids.length };
  });

export const bulkArchiveByCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      codes: z.array(z.string().min(1)).min(1).max(5000),
      year: z.string().min(2).max(20),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codes = Array.from(new Set(data.codes.map((c) => c.trim()).filter(Boolean)));
    const { data: found, error: qErr } = await supabaseAdmin
      .from("students")
      .select("id, code")
      .in("code", codes);
    if (qErr) throw new Error(qErr.message);
    const ids = (found ?? []).map((r: any) => r.id as string);
    const foundCodes = new Set((found ?? []).map((r: any) => r.code));
    const notFound = codes.filter((c) => !foundCodes.has(c));
    if (ids.length > 0) {
      const { error } = await supabaseAdmin
        .from("students")
        .update({ archived_at: new Date().toISOString(), archived_year: data.year, status: "suspended" })
        .in("id", ids);
      if (error) throw new Error(error.message);
      await log(supabaseAdmin, context.userId, "archive_bulk_codes", { count: ids.length, year: data.year });
    }
    return { ok: true, archived: ids.length, notFound };
  });

