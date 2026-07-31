import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { studentEmailFromCode } from "./auth-emails";

const StudentInput = z.object({
  full_name: z.string().trim().min(2).max(80),
  code: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/, "الحروف الإنجليزية والأرقام فقط"),
  password: z.string().min(6).max(72).optional().nullable(),
  gender: z.enum(["male", "female"]).nullable().optional(),
  birth_date: z.string().nullable().optional(),
  class_id: z.string().uuid().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
  seat_number: z.string().max(30).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  parent_name: z.string().max(80).nullable().optional(),
  parent_phone: z.string().max(30).nullable().optional(),
  parent_whatsapp: z.string().max(30).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("مسموح للأدمن فقط");
}

async function logActivity(admin: any, actorId: string, action: string, entityId: string | null, meta: Record<string, unknown> = {}) {
  await admin.from("activity_log").insert({ actor_id: actorId, action, entity_type: "student", entity_id: entityId, meta });
}

// Admin-only credential vault (service_role access only, never exposed to clients directly)
async function saveCredential(admin: any, studentId: string, password: string) {
  try {
    await admin
      .from("student_credentials")
      .upsert({ student_id: studentId, password, updated_at: new Date().toISOString() }, { onConflict: "student_id" });
  } catch {}
}

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StudentInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check code uniqueness
    const { data: existing } = await supabaseAdmin.from("students").select("id").eq("code", data.code).maybeSingle();
    if (existing) throw new Error("كود الطالب مستخدم بالفعل");

    const email = studentEmailFromCode(data.code);
    const password = data.password && data.password.length >= 6 ? data.password : data.code;
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { code: data.code, full_name: data.full_name, kind: "student" },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "فشل إنشاء حساب الطالب");
    const userId = created.user.id;

    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "student" });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(rErr.message);
    }

    const { password: _pw, ...rest } = data;
    const { data: row, error: sErr } = await supabaseAdmin
      .from("students")
      .insert({ ...rest, user_id: userId })
      .select("id")
      .single();

    if (sErr || !row) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(sErr?.message ?? "فشل حفظ بيانات الطالب");
    }

    await saveCredential(supabaseAdmin, row.id, password);
    await logActivity(supabaseAdmin, context.userId, "create", row.id, { code: data.code, name: data.full_name });
    return { ok: true, id: row.id };
  });

export const updateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), patch: StudentInput.partial() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { password, code, ...patch } = data.patch as any;

    // If code changed, ensure uniqueness and update auth email
    if (code) {
      const { data: dup } = await supabaseAdmin.from("students").select("id").eq("code", code).neq("id", data.id).maybeSingle();
      if (dup) throw new Error("كود الطالب مستخدم بالفعل");
      patch.code = code;
      const { data: row } = await supabaseAdmin.from("students").select("user_id").eq("id", data.id).maybeSingle();
      if (row?.user_id) {
        await supabaseAdmin.auth.admin.updateUserById(row.user_id, { email: studentEmailFromCode(code) });
      }
    }

    if (password && password.length >= 6) {
      const { data: row } = await supabaseAdmin.from("students").select("user_id").eq("id", data.id).maybeSingle();
      if (row?.user_id) {
        await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password });
        await saveCredential(supabaseAdmin, data.id, password);
      }
    }


    const { error } = await supabaseAdmin.from("students").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logActivity(supabaseAdmin, context.userId, "update", data.id, {});
    return { ok: true };
  });

export const deleteStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("students").select("id, user_id").in("id", data.ids);
    if (rows) {
      await supabaseAdmin.from("students").delete().in("id", data.ids);
      for (const r of rows) {
        if (r.user_id) {
          try { await supabaseAdmin.auth.admin.deleteUser(r.user_id); } catch {}
        }
      }
    }
    await logActivity(supabaseAdmin, context.userId, "delete", null, { ids: data.ids });
    return { ok: true, count: data.ids.length };
  });

export const toggleStudentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1), status: z.enum(["active", "suspended"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("students").update({ status: data.status }).in("id", data.ids);
    if (error) throw new Error(error.message);

    // Ban/unban auth users
    const { data: rows } = await supabaseAdmin.from("students").select("user_id").in("id", data.ids);
    for (const r of rows ?? []) {
      if (r.user_id) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(r.user_id, {
            ban_duration: data.status === "suspended" ? "876000h" : "none",
          } as any);
        } catch {}
      }
    }

    await logActivity(supabaseAdmin, context.userId, data.status === "suspended" ? "suspend" : "activate", null, { ids: data.ids });
    return { ok: true };
  });

export const resetStudentPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), password: z.string().min(6).max(72) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("students").select("user_id").eq("id", data.id).maybeSingle();
    if (!row?.user_id) throw new Error("الطالب غير موجود");
    await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password: data.password });
    await saveCredential(supabaseAdmin, data.id, data.password);
    await logActivity(supabaseAdmin, context.userId, "reset_password", data.id, {});
    return { ok: true };
  });

export const getStudentPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("students")
      .select("code")
      .eq("id", data.id)
      .maybeSingle();
    const { data: cred } = await supabaseAdmin
      .from("student_credentials")
      .select("password")
      .eq("student_id", data.id)
      .maybeSingle();
    return { code: row?.code ?? null, password: (cred as any)?.password ?? null as string | null };
  });


export const bulkCreateStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ students: z.array(StudentInput).min(1).max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let created = 0;
    const errors: { code: string; error: string }[] = [];
    for (const s of data.students) {
      try {
        const { data: existing } = await supabaseAdmin.from("students").select("id").eq("code", s.code).maybeSingle();
        if (existing) { errors.push({ code: s.code, error: "الكود مستخدم" }); continue; }
        const email = studentEmailFromCode(s.code);
        const password = s.password && s.password.length >= 6 ? s.password : s.code;
        const { data: u, error: cErr } = await supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { code: s.code, kind: "student" },
        });
        if (cErr || !u.user) { errors.push({ code: s.code, error: cErr?.message ?? "فشل الإنشاء" }); continue; }
        await supabaseAdmin.from("user_roles").insert({ user_id: u.user.id, role: "student" });
        const { password: _pw, ...rest } = s;
        const { data: newRow, error: sErr } = await supabaseAdmin.from("students").insert({ ...rest, user_id: u.user.id }).select("id").single();
        if (!sErr && newRow) await saveCredential(supabaseAdmin, newRow.id, password);

        if (sErr) { errors.push({ code: s.code, error: sErr.message }); await supabaseAdmin.auth.admin.deleteUser(u.user.id); continue; }
        created++;
      } catch (e: any) {
        errors.push({ code: s.code, error: e?.message ?? "خطأ غير معروف" });
      }
    }
    await logActivity(supabaseAdmin, context.userId, "bulk_import", null, { created, failed: errors.length });
    return { created, errors };
  });
