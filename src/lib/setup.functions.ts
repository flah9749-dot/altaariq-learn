import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminEmailFromUsername } from "./auth-emails";

const SetupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "اسم المستخدم قصير جدًا")
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, "الحروف الإنجليزية والأرقام فقط"),
  password: z.string().min(6, "كلمة المرور قصيرة جدًا").max(72),
  fullName: z.string().trim().min(2).max(80).optional().nullable(),
});

// Public — creates the first admin ONLY if no admin exists yet. Used by /setup.
export const setupInitialAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SetupSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error("تم تهيئة الأدمن بالفعل. استخدم صفحة تسجيل الدخول.");
    }

    const email = adminEmailFromUsername(data.username);
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, full_name: data.fullName ?? null, kind: "admin" },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "فشل إنشاء الحساب");

    const userId = created.user.id;
    const [{ error: r1 }, { error: r2 }] = await Promise.all([
      supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" }),
      supabaseAdmin
        .from("admins")
        .insert({ user_id: userId, username: data.username, full_name: data.fullName ?? data.username }),
    ]);
    if (r1) throw new Error(r1.message);
    if (r2) throw new Error(r2.message);

    return { ok: true };
  });

// Public — returns whether the platform still needs its first admin.
export const adminInitStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { hasAdmin: (count ?? 0) > 0 };
});
