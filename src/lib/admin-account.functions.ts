import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminEmailFromUsername } from "./auth-emails";

const NewAdminSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(6).max(72),
  fullName: z.string().trim().min(2).max(80),
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("صلاحيات غير كافية");
}

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NewAdminSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = adminEmailFromUsername(data.username);
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, full_name: data.fullName, kind: "admin" },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "فشل إنشاء الحساب");

    const userId = created.user.id;
    const [{ error: r1 }, { error: r2 }] = await Promise.all([
      supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" }),
      supabaseAdmin.from("admins").insert({ user_id: userId, username: data.username, full_name: data.fullName }),
    ]);
    if (r1) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(r1.message);
    }
    if (r2) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(r2.message);
    }
    return { ok: true, user_id: userId };
  });

export const deleteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ admin_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: fErr } = await supabaseAdmin
      .from("admins").select("id,user_id").eq("id", data.admin_id).maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!row) throw new Error("الأدمن غير موجود");
    if (row.user_id === context.userId) throw new Error("لا يمكنك حذف حسابك الحالي");

    const { count } = await supabaseAdmin
      .from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) throw new Error("لا يمكن حذف آخر أدمن في المنصة");

    await supabaseAdmin.from("admins").delete().eq("id", row.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", row.user_id).eq("role", "admin");
    await supabaseAdmin.auth.admin.deleteUser(row.user_id);
    return { ok: true };
  });

export const resetAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    admin_id: z.string().uuid(),
    password: z.string().min(6).max(72),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("admins").select("user_id").eq("id", data.admin_id).maybeSingle();
    if (!row) throw new Error("الأدمن غير موجود");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
