import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Aggregated AI usage / cost / cache stats for the admin dashboard.
export const getAiUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { days?: number }) => data ?? {})
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("مسموح للأدمن فقط");

    const days = data?.days ?? 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("ai_usage_logs")
      .select("task_type, model, model_tier, cache_hit, tokens_in, tokens_out, tokens_used, estimated_cost, latency_ms, success, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    const list = rows ?? [];
    const totalRequests = list.length;
    const cacheHits = list.filter((r: any) => r.cache_hit).length;
    const failures = list.filter((r: any) => !r.success).length;
    const totalTokens = list.reduce((s: number, r: any) => s + (r.tokens_in ?? 0) + (r.tokens_out ?? 0), 0);
    const totalCost = list.reduce((s: number, r: any) => s + Number(r.estimated_cost ?? 0), 0);

    // Group by task_type
    const byTask: Record<string, { count: number; tokens: number; cost: number; hits: number }> = {};
    for (const r of list) {
      const k = (r as any).task_type || (r as any).model || "unknown";
      byTask[k] = byTask[k] ?? { count: 0, tokens: 0, cost: 0, hits: 0 };
      byTask[k].count += 1;
      byTask[k].tokens += ((r as any).tokens_in ?? 0) + ((r as any).tokens_out ?? 0);
      byTask[k].cost += Number((r as any).estimated_cost ?? 0);
      if ((r as any).cache_hit) byTask[k].hits += 1;
    }

    // Group by model
    const byModel: Record<string, { count: number; tokens: number; cost: number; avgLatency: number }> = {};
    for (const r of list) {
      const k = (r as any).model || "-";
      const rec = byModel[k] ?? { count: 0, tokens: 0, cost: 0, avgLatency: 0 };
      const t = ((r as any).tokens_in ?? 0) + ((r as any).tokens_out ?? 0);
      const lat = Number((r as any).latency_ms ?? 0);
      rec.avgLatency = (rec.avgLatency * rec.count + lat) / (rec.count + 1);
      rec.count += 1;
      rec.tokens += t;
      rec.cost += Number((r as any).estimated_cost ?? 0);
      byModel[k] = rec;
    }

    // Daily buckets
    const byDay: Record<string, { requests: number; tokens: number; cost: number; hits: number }> = {};
    for (const r of list) {
      const d = new Date((r as any).created_at).toISOString().slice(0, 10);
      byDay[d] = byDay[d] ?? { requests: 0, tokens: 0, cost: 0, hits: 0 };
      byDay[d].requests += 1;
      byDay[d].tokens += ((r as any).tokens_in ?? 0) + ((r as any).tokens_out ?? 0);
      byDay[d].cost += Number((r as any).estimated_cost ?? 0);
      if ((r as any).cache_hit) byDay[d].hits += 1;
    }

    // Cache stats
    const { count: cacheCount } = await supabaseAdmin
      .from("ai_cache")
      .select("*", { count: "exact", head: true });

    const { count: docsCount } = await supabaseAdmin
      .from("ai_extracted_documents")
      .select("*", { count: "exact", head: true });

    return {
      totals: {
        requests: totalRequests,
        cacheHits,
        cacheHitRate: totalRequests ? cacheHits / totalRequests : 0,
        failures,
        tokens: totalTokens,
        cost: totalCost,
      },
      byTask: Object.entries(byTask)
        .map(([task, v]) => ({ task, ...v }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 10),
      byModel: Object.entries(byModel)
        .map(([model, v]) => ({ model, ...v, avgLatency: Math.round(v.avgLatency) }))
        .sort((a, b) => b.count - a.count),
      byDay: Object.entries(byDay)
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      cacheEntries: cacheCount ?? 0,
      cachedDocuments: docsCount ?? 0,
      windowDays: days,
    };
  });

export const clearAiCache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskType?: string }) => data ?? {})
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("مسموح للأدمن فقط");
    const { clearCache } = await import("@/lib/ai/cache.server");
    await clearCache(data?.taskType);
    return { ok: true };
  });
