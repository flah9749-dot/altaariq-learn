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
    const { hasKey } = await import("./ai-multi-provider.server");
    return Object.fromEntries(SLUGS.map(s => [s, hasKey(s)])) as Record<Slug, boolean>;
  });
