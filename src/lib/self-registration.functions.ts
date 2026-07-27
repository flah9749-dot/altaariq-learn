import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { studentEmailFromCode } from "@/lib/auth-emails";
import {
  generatePassword,
  generateStudentCode,
  normalizeCode,
  normalizePhone,
  normalizeIntlPhone,
  buildWhatsAppText,
} from "@/lib/self-registration.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("مسموح للأدمن فقط");
}

function getClientIp(): string | null {
  try {
    const req = getRequest();
    const h = req.headers;
    return (
      h.get("cf-connecting-ip") ||
      h.get("x-real-ip") ||
      (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
      null
    );
  } catch {
    return null;
  }
}
function getUserAgent(): string | null {
  try {
    return getRequest().headers.get("user-agent");
  } catch { return null; }
}

async function getSelfRegSettings(admin: any) {
  const { data } = await admin
    .from("settings")
    .select("key,value")
    .in("key", [
      "self_registration.enabled",
      "self_registration.auto_approve",
      "self_registration.send_to_student_phone",
      "platform.name",
    ]);
  const map = new Map<string, any>();
  (data ?? []).forEach((r: any) => map.set(r.key, r.value));
  return {
    enabled: map.get("self_registration.enabled") !== false,
    autoApprove: map.get("self_registration.auto_approve") !== false,
    sendToStudent: map.get("self_registration.send_to_student_phone") === true,
    platformName:
      (typeof map.get("platform.name") === "string" ? map.get("platform.name") : "الطارق التعليمية"),
  };
}

// ---------- Public: validate a code ----------
export const validateJoinCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(2).max(40) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("validate_join_code", {
      _code: normalizeCode(data.code),
    });
    if (error) throw new Error(error.message);
    return result as any;
  });

// ---------- Internal: perform account creation (used by submit + admin approve) ----------
async function performApproval(admin: any, req: {
  id: string;
  full_name: string;
  student_phone: string;
  parent_phone: string;
  parent_name: string | null;
  class_id: string;
  group_id: string;
  avatar_url: string | null;
  code_id: string;
}, opts: { autoApproved: boolean; reviewerId?: string | null }) {
  // Duplicate phone re-check
  const { data: dup } = await admin.from("students").select("id").eq("phone", req.student_phone).maybeSingle();
  if (dup) throw new Error("رقم هاتف الطالب مسجّل بالفعل");

  // Generate unique code
  let code = generateStudentCode();
  for (let i = 0; i < 5; i++) {
    const { data: exists } = await admin.from("students").select("id").eq("code", code).maybeSingle();
    if (!exists) break;
    code = generateStudentCode();
  }
  const password = generatePassword(10);
  const email = studentEmailFromCode(code);

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { code, full_name: req.full_name, kind: "student" },
  });
  if (cErr || !created?.user) throw new Error(cErr?.message ?? "فشل إنشاء حساب المصادقة");
  const userId = created.user.id;

  const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role: "student" });
  if (rErr) { await admin.auth.admin.deleteUser(userId); throw new Error(rErr.message); }

  const { data: st, error: sErr } = await admin.from("students").insert({
    user_id: userId,
    code,
    full_name: req.full_name,
    phone: req.student_phone,
    parent_phone: req.parent_phone,
    parent_whatsapp: req.parent_phone,
    parent_name: req.parent_name,
    class_id: req.class_id,
    group_id: req.group_id,
    avatar_url: req.avatar_url,
    plaintext_password: password,
    status: "active",
  }).select("id").single();
  if (sErr || !st) { await admin.auth.admin.deleteUser(userId); throw new Error(sErr?.message ?? "فشل حفظ بيانات الطالب"); }

  await admin.rpc("increment_join_code_use", { _code_id: req.code_id });

  await admin.from("registration_requests").update({
    status: opts.autoApproved ? "auto_approved" : "approved",
    student_id: st.id,
    reviewed_at: new Date().toISOString(),
    reviewed_by: opts.reviewerId ?? null,
  }).eq("id", req.id);

  return { studentId: st.id, code, password };
}

// ---------- Public: submit a registration ----------
const SubmitSchema = z.object({
  code: z.string().trim().min(2).max(40),
  full_name: z.string().trim().min(4, "الاسم الرباعي مطلوب").max(120),
  student_phone: z.string().trim().min(6).max(30),
  parent_phone: z.string().trim().min(6).max(30),
  parent_name: z.string().trim().max(80).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  consent: z.literal(true, { errorMap: () => ({ message: "يجب الموافقة على الشروط" }) }),
});

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SubmitSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await getSelfRegSettings(supabaseAdmin);
    if (!settings.enabled) throw new Error("التسجيل الذاتي معطّل حالياً");

    const codeNorm = normalizeCode(data.code);
    const studentPhone = normalizePhone(data.student_phone);
    const parentPhone = normalizePhone(data.parent_phone);
    if (studentPhone === parentPhone) throw new Error("رقم الطالب يجب أن يختلف عن رقم ولي الأمر");
    if (studentPhone.length < 6) throw new Error("رقم هاتف غير صحيح");

    // Validate code
    const { data: v, error: vErr } = await supabaseAdmin.rpc("validate_join_code", { _code: codeNorm });
    if (vErr) throw new Error(vErr.message);
    const info: any = v;
    if (!info?.valid) throw new Error(info?.reason ?? "كود غير صالح");

    // Duplicate checks
    const { data: dup } = await supabaseAdmin.from("students").select("id").eq("phone", studentPhone).maybeSingle();
    if (dup) throw new Error("رقم هاتف الطالب مسجّل بالفعل");

    // Rate limit: max 5 requests per IP per 10 minutes
    const ip = getClientIp();
    if (ip) {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin.from("registration_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", since);
      if ((count ?? 0) >= 5) throw new Error("محاولات كثيرة، حاول مرة أخرى بعد قليل");
    }

    // Prevent same phone pending twice
    const { data: pend } = await supabaseAdmin.from("registration_requests")
      .select("id").eq("student_phone", studentPhone).eq("status", "pending").maybeSingle();
    if (pend) throw new Error("يوجد طلب تسجيل معلّق بنفس رقم الهاتف");

    // Insert request
    const { data: req, error: rErr } = await supabaseAdmin.from("registration_requests").insert({
      code_id: info.code_id,
      full_name: data.full_name.trim(),
      student_phone: studentPhone,
      parent_phone: parentPhone,
      parent_name: data.parent_name?.trim() || null,
      class_id: info.class_id,
      group_id: info.group_id,
      avatar_url: data.avatar_url ?? null,
      status: "pending",
      ip_address: ip,
      user_agent: getUserAgent(),
    }).select("id").single();
    if (rErr || !req) throw new Error(rErr?.message ?? "فشل حفظ طلب التسجيل");

    if (!settings.autoApprove) {
      return {
        status: "pending" as const,
        message: "تم استلام طلبك بنجاح. سيتم مراجعته من قِبل المدرس وإبلاغك عند التفعيل.",
      };
    }

    // Auto-approve
    try {
      const res = await performApproval(supabaseAdmin, {
        id: req.id,
        full_name: data.full_name.trim(),
        student_phone: studentPhone,
        parent_phone: parentPhone,
        parent_name: data.parent_name?.trim() || null,
        class_id: info.class_id,
        group_id: info.group_id,
        avatar_url: data.avatar_url ?? null,
        code_id: info.code_id,
      }, { autoApproved: true });

      const loginUrl = `${new URL(getRequest().url).origin}/login`;
      const waText = buildWhatsAppText({
        platformName: settings.platformName,
        studentName: data.full_name.trim(),
        studentCode: res.code,
        password: res.password,
        loginUrl,
      });
      const parentWa = normalizeIntlPhone(parentPhone);
      const studentWa = normalizeIntlPhone(studentPhone);
      const waLinkParent = parentWa ? `https://wa.me/${parentWa}?text=${encodeURIComponent(waText)}` : null;
      const waLinkStudent = settings.sendToStudent && studentWa
        ? `https://wa.me/${studentWa}?text=${encodeURIComponent(waText)}`
        : null;

      return {
        status: "approved" as const,
        message: "تم إنشاء حسابك بنجاح!",
        credentials: { code: res.code, password: res.password, loginUrl },
        whatsapp: { parent: waLinkParent, student: waLinkStudent },
      };
    } catch (e: any) {
      await supabaseAdmin.from("registration_requests")
        .update({ status: "rejected", reject_reason: e?.message ?? "فشل الإنشاء التلقائي" })
        .eq("id", req.id);
      throw e;
    }
  });

// ---------- Admin: manage codes ----------
const CodeInput = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_\-]+$/, "الحروف الإنجليزية والأرقام فقط"),
  class_id: z.string().uuid(),
  group_id: z.string().uuid(),
  active: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
});

export const listJoinCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("join_codes")
      .select("*, classes(name), groups(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createJoinCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = normalizeCode(data.code);
    const { data: dup } = await supabaseAdmin.from("join_codes").select("id").eq("code", code).maybeSingle();
    if (dup) throw new Error("الكود مستخدم بالفعل");
    const { data: row, error } = await supabaseAdmin.from("join_codes").insert({
      code,
      class_id: data.class_id,
      group_id: data.group_id,
      active: data.active ?? true,
      expires_at: data.expires_at ?? null,
      max_uses: data.max_uses ?? null,
      notes: data.notes ?? null,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row!.id };
  });

export const updateJoinCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: CodeInput.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { ...data.patch };
    if (patch.code) patch.code = normalizeCode(patch.code);
    const { error } = await supabaseAdmin.from("join_codes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteJoinCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("join_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: manage requests ----------
export const listRegistrationRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["pending", "approved", "rejected", "auto_approved", "all"]).default("all") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("registration_requests")
      .select("*, join_codes(code), classes(name), groups(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const approveRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      overrides: z.object({
        full_name: z.string().trim().min(2).max(120).optional(),
        student_phone: z.string().trim().min(6).max(30).optional(),
        parent_phone: z.string().trim().min(6).max(30).optional(),
        parent_name: z.string().trim().max(80).nullable().optional(),
      }).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error } = await supabaseAdmin.from("registration_requests").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("الطلب غير موجود");
    if (req.status === "approved" || req.status === "auto_approved") throw new Error("الطلب معتمد بالفعل");

    const o = data.overrides ?? {};
    const patched = {
      id: req.id,
      full_name: (o.full_name ?? req.full_name).trim(),
      student_phone: normalizePhone(o.student_phone ?? req.student_phone),
      parent_phone: normalizePhone(o.parent_phone ?? req.parent_phone),
      parent_name: (o.parent_name ?? req.parent_name) || null,
      class_id: req.class_id,
      group_id: req.group_id,
      avatar_url: req.avatar_url,
      code_id: req.code_id,
    };

    const res = await performApproval(supabaseAdmin, patched, {
      autoApproved: false, reviewerId: context.userId,
    });

    const settings = await getSelfRegSettings(supabaseAdmin);
    const loginUrl = `${new URL(getRequest().url).origin}/login`;
    const waText = buildWhatsAppText({
      platformName: settings.platformName,
      studentName: patched.full_name,
      studentCode: res.code,
      password: res.password,
      loginUrl,
    });
    const parentWa = normalizeIntlPhone(patched.parent_phone);
    const studentWa = normalizeIntlPhone(patched.student_phone);
    return {
      ok: true,
      studentId: res.studentId,
      credentials: { code: res.code, password: res.password, loginUrl },
      whatsapp: {
        parent: parentWa ? `https://wa.me/${parentWa}?text=${encodeURIComponent(waText)}` : null,
        student: settings.sendToStudent && studentWa
          ? `https://wa.me/${studentWa}?text=${encodeURIComponent(waText)}`
          : null,
      },
    };
  });

export const rejectRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("registration_requests").update({
      status: "rejected",
      reject_reason: data.reason ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRegistrationStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("registration_requests")
      .select("status, created_at")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: rows.length,
      today: rows.filter((r: any) => (r.created_at as string).slice(0, 10) === today).length,
      pending: rows.filter((r: any) => r.status === "pending").length,
      approved: rows.filter((r: any) => r.status === "approved" || r.status === "auto_approved").length,
      rejected: rows.filter((r: any) => r.status === "rejected").length,
    };
  });
