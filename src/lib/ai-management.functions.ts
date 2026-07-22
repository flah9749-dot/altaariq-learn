import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SLUGS = ["lovable","gemini","openai","claude","groq","deepseek","mistral","openrouter"] as const;
type Slug = typeof SLUGS[number];

export const testAIProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.enum(SLUGS) }).parse(d))
  .handler(async ({ data, context }) => {
    // admin check
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as any });
    if (!isAdmin) throw new Error("Forbidden");

    const { testProviderConnection } = await import("./ai-multi-provider.server");
    const result = await testProviderConnection(data.slug as Slug);

    // update ai_providers
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_providers").update({
      test_status: result.ok ? "ok" : "fail",
      test_error: result.error ?? null,
      last_tested_at: new Date().toISOString(),
      avg_latency_ms: result.latencyMs,
    }).eq("slug", data.slug);

    return result;
  });

export const setAIFunctionProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    function_key: z.string().min(1),
    provider_slug: z.enum(SLUGS),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as any });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("ai_function_mapping")
      .update({ provider_slug: data.provider_slug, updated_at: new Date().toISOString() })
      .eq("function_key", data.function_key);
    if (error) throw error;
    return { ok: true };
  });

export const toggleAIProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.enum(SLUGS), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as any });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("ai_providers")
      .update({ enabled: data.enabled }).eq("slug", data.slug);
    if (error) throw error;
    return { ok: true };
  });

export const setProviderPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.enum(SLUGS), priority: z.number().int().min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as any });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("ai_providers")
      .update({ priority: data.priority }).eq("slug", data.slug);
    if (error) throw error;
    return { ok: true };
  });

export const checkAIKeysStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as any });
    if (!isAdmin) throw new Error("Forbidden");
    const { hasKey, getEnvKey } = await import("./ai-multi-provider.server");
    const entries = await Promise.all(SLUGS.map(async (s) => {
      const ok = await hasKey(s);
      const env = !!getEnvKey(s);
      return [s, { ok, env, db: ok && !env }] as const;
    }));
    return Object.fromEntries(entries) as Record<Slug, { ok: boolean; env: boolean; db: boolean }>;
  });

export const saveProviderKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.enum(SLUGS), key: z.string().min(8).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as any });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prov } = await supabaseAdmin.from("ai_providers").select("id").eq("slug", data.slug).maybeSingle();
    if (!prov?.id) throw new Error("Provider not found");
    // Remove old rows for this provider, then insert the new key.
    await supabaseAdmin.from("ai_api_keys").delete().eq("provider_id", prov.id);
    const { error } = await supabaseAdmin.from("ai_api_keys").insert({
      provider_id: prov.id,
      label: data.slug,
      encrypted_key: data.key.trim(),
      enabled: true,
    });
    if (error) throw error;
    const { invalidateKeyCache } = await import("./ai-multi-provider.server");
    invalidateKeyCache(data.slug as Slug);
    return { ok: true };
  });

export const deleteProviderKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.enum(SLUGS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as any });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prov } = await supabaseAdmin.from("ai_providers").select("id").eq("slug", data.slug).maybeSingle();
    if (!prov?.id) throw new Error("Provider not found");
    await supabaseAdmin.from("ai_api_keys").delete().eq("provider_id", prov.id);
    const { invalidateKeyCache } = await import("./ai-multi-provider.server");
    invalidateKeyCache(data.slug as Slug);
    return { ok: true };
  });

