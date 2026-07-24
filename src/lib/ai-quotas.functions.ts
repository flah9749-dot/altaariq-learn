import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { QuotaFeature, QuotaPeriod } from "./ai/quotas.server";

const FEATURES = [
  "assistant_message",
  "file_upload",
  "exam_generation",
  "essay_grading",
  "summary",
  "lesson_explain",
  "map_analysis",
  "content_plan",
] as const;

async function requireAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("مسموح للأدمن فقط");
}

/** ------- POLICIES ------- */

export const listQuotaPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_quota_policies")
      .select("*")
      .order("role", { ascending: true })
      .order("feature", { ascending: true });
    return data ?? [];
  });

export const upsertQuotaPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        role: z.enum(["admin", "student"]),
        feature: z.enum(FEATURES),
        period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
        limit_count: z.number().int().min(0),
        max_file_mb: z.number().int().min(1).nullable().optional(),
        max_pages: z.number().int().min(1).nullable().optional(),
        enabled: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_quota_policies")
      .upsert(
        {
          id: data.id,
          role: data.role,
          feature: data.feature,
          period: data.period,
          limit_count: data.limit_count,
          max_file_mb: data.max_file_mb ?? null,
          max_pages: data.max_pages ?? null,
          enabled: data.enabled,
        },
        { onConflict: "role,feature" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ------- USER OVERRIDES ------- */

export const listUserOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("ai_quota_overrides")
      .select("*")
      .eq("user_id", data.user_id)
      .order("feature");
    return rows ?? [];
  });

export const upsertUserOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        feature: z.enum(FEATURES),
        period: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
        limit_count: z.number().int().min(0).nullable().optional(),
        unlimited: z.boolean().default(false),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_quota_overrides")
      .upsert(
        {
          user_id: data.user_id,
          feature: data.feature,
          period: data.period ?? null,
          limit_count: data.limit_count ?? null,
          unlimited: data.unlimited,
          notes: data.notes ?? null,
        },
        { onConflict: "user_id,feature" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_quota_overrides").delete().eq("id", data.id);
    return { ok: true };
  });

/** ------- CURRENT USAGE ------- */

export const getUserQuotaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveQuota, periodKey } = await import("./ai/quotas.server");

    // Role of target user
    const { data: rolesRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .maybeSingle();
    const role: "admin" | "student" = (rolesRow?.role as any) ?? "student";

    const out: any[] = [];
    for (const f of FEATURES) {
      const q = await resolveQuota(data.user_id, role, f as QuotaFeature);
      const key = periodKey(q.period as QuotaPeriod);
      const { data: usage } = await supabaseAdmin
        .from("ai_quota_usage")
        .select("count, last_used_at")
        .eq("user_id", data.user_id)
        .eq("feature", f)
        .eq("period_key", key)
        .maybeSingle();
      out.push({
        feature: f,
        period: q.period,
        limit: q.unlimited ? null : q.limit,
        unlimited: q.unlimited,
        used: usage?.count ?? 0,
        last_used_at: usage?.last_used_at ?? null,
      });
    }
    return { role, features: out };
  });

export const resetUserQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        feature: z.enum(FEATURES).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("ai_quota_usage").delete().eq("user_id", data.user_id);
    if (data.feature) q = q.eq("feature", data.feature);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ------- LEADERBOARD (top consumers) ------- */

export const getQuotaLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(7) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const { data: rows } = await supabaseAdmin
      .from("ai_usage_logs")
      .select("user_id, feature, charged, tokens_in, tokens_out, estimated_cost, created_at")
      .gte("created_at", since)
      .limit(20000);

    const byUser: Record<string, { requests: number; charged: number; tokens: number; cost: number }> = {};
    const byFeature: Record<string, { requests: number; charged: number; tokens: number; cost: number }> = {};
    for (const r of rows ?? []) {
      const uid = (r as any).user_id ?? "anon";
      const feat = (r as any).feature ?? "-";
      const tokens = ((r as any).tokens_in ?? 0) + ((r as any).tokens_out ?? 0);
      const cost = Number((r as any).estimated_cost ?? 0);
      const charged = (r as any).charged ? 1 : 0;
      byUser[uid] = byUser[uid] ?? { requests: 0, charged: 0, tokens: 0, cost: 0 };
      byUser[uid].requests += 1;
      byUser[uid].charged += charged;
      byUser[uid].tokens += tokens;
      byUser[uid].cost += cost;
      byFeature[feat] = byFeature[feat] ?? { requests: 0, charged: 0, tokens: 0, cost: 0 };
      byFeature[feat].requests += 1;
      byFeature[feat].charged += charged;
      byFeature[feat].tokens += tokens;
      byFeature[feat].cost += cost;
    }

    // Resolve names for top users
    const topUserIds = Object.entries(byUser)
      .sort((a, b) => b[1].requests - a[1].requests)
      .slice(0, 10)
      .map(([id]) => id)
      .filter((x) => x !== "anon");
    let names: Record<string, string> = {};
    if (topUserIds.length) {
      const [{ data: st }, { data: ad }] = await Promise.all([
        supabaseAdmin.from("students").select("user_id, full_name").in("user_id", topUserIds),
        supabaseAdmin.from("admins").select("user_id, full_name").in("user_id", topUserIds),
      ]);
      for (const r of st ?? []) if ((r as any).user_id) names[(r as any).user_id] = (r as any).full_name;
      for (const r of ad ?? []) if ((r as any).user_id) names[(r as any).user_id] = (r as any).full_name + " (معلم)";
    }

    return {
      topUsers: Object.entries(byUser)
        .map(([user_id, v]) => ({ user_id, name: names[user_id] ?? user_id, ...v }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 10),
      byFeature: Object.entries(byFeature)
        .map(([feature, v]) => ({ feature, ...v }))
        .sort((a, b) => b.requests - a.requests),
      windowDays: data.days,
    };
  });

/** ------- SEARCH USERS ------- */

export const searchUsersForQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ q: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const term = `%${data.q}%`;
    const [{ data: st }, { data: ad }] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("user_id, full_name, student_code")
        .ilike("full_name", term)
        .not("user_id", "is", null)
        .limit(20),
      supabaseAdmin
        .from("admins")
        .select("user_id, full_name")
        .ilike("full_name", term)
        .not("user_id", "is", null)
        .limit(10),
    ]);
    const students = (st ?? []).map((r: any) => ({ user_id: r.user_id, name: r.full_name, sub: r.student_code, role: "student" }));
    const admins = (ad ?? []).map((r: any) => ({ user_id: r.user_id, name: r.full_name, sub: "معلم", role: "admin" }));
    return [...admins, ...students];
  });

/** ------- STUDENT: MY QUOTAS ------- */

export const getMyQuotas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveQuota, periodKey, nextResetIso } = await import("./ai/quotas.server");
    const { data: rolesRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    const role: "admin" | "student" = (rolesRow?.role as any) ?? "student";
    const out: any[] = [];
    for (const f of FEATURES) {
      const q = await resolveQuota(context.userId, role, f as QuotaFeature);
      const key = periodKey(q.period as QuotaPeriod);
      const { data: usage } = await supabaseAdmin
        .from("ai_quota_usage")
        .select("count")
        .eq("user_id", context.userId)
        .eq("feature", f)
        .eq("period_key", key)
        .maybeSingle();
      out.push({
        feature: f,
        period: q.period,
        limit: q.unlimited ? null : q.limit,
        unlimited: q.unlimited,
        used: usage?.count ?? 0,
        resetAt: nextResetIso(q.period as QuotaPeriod),
      });
    }
    return out;
  });
