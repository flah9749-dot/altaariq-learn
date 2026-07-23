// Persistent cache for AI results. Key = SHA256(task + normalized-input + model-tier).
// Callers should pre-normalize their input (trim, lower-case keys that don't matter)
// so equivalent requests hash the same.

import { sha256Hex, stableStringify } from "./hash.server";

export async function buildCacheKey(taskType: string, input: unknown, extra?: string) {
  return sha256Hex(taskType + "|" + (extra ?? "") + "|" + stableStringify(input));
}

export async function readCache<T = unknown>(cacheKey: string): Promise<T | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_cache")
      .select("id, result, expires_at, hit_count")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at as any).getTime() < Date.now()) return null;

    // Best-effort hit stats.
    supabaseAdmin
      .from("ai_cache")
      .update({ hit_count: (data.hit_count ?? 0) + 1, last_hit_at: new Date().toISOString() })
      .eq("id", data.id)
      .then(() => {}, () => {});

    return data.result as T;
  } catch {
    return null;
  }
}

export async function writeCache(opts: {
  cacheKey: string;
  taskType: string;
  model?: string;
  provider?: string;
  result: unknown;
  tokensIn?: number;
  tokensOut?: number;
  ttlSeconds?: number;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expiresAt = opts.ttlSeconds
      ? new Date(Date.now() + opts.ttlSeconds * 1000).toISOString()
      : null;
    await supabaseAdmin.from("ai_cache").upsert({
      cache_key: opts.cacheKey,
      task_type: opts.taskType,
      model: opts.model ?? null,
      provider: opts.provider ?? null,
      result: opts.result as any,
      tokens_in: opts.tokensIn ?? 0,
      tokens_out: opts.tokensOut ?? 0,
      expires_at: expiresAt,
    }, { onConflict: "cache_key" });
  } catch {}
}

export async function clearCache(taskType?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const q = supabaseAdmin.from("ai_cache").delete();
  if (taskType) await q.eq("task_type", taskType);
  else await q.neq("id", "00000000-0000-0000-0000-000000000000");
}
