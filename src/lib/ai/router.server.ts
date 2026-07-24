// Central AI router. Every AI call in the app goes through `callAI(taskType, ...)`.
// It handles: cache lookup, rate limiting, model tier selection, provider fallback,
// usage logging (tokens, latency, cost), and returning a normalized reply.
//
// Provider chain: prefer Lovable AI Gateway (multimodal + billing built-in),
// then fall back to any user-configured direct providers via the existing
// ai-multi-provider dispatcher for text-only tasks.

import type { TaskType } from "./task-registry.server";
import { getTask, modelsForTier, estimateCost } from "./task-registry.server";
import { buildCacheKey, readCache, writeCache } from "./cache.server";
import { enforceRateLimit, guardDuplicate, hashRequest } from "./rate-limiter.server";
import { checkQuota, commitQuotaUsage, taskToFeature, QuotaExceededError } from "./quotas.server";


const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

export type CallAiOptions = {
  /** Bypass cache read (still writes on success). */
  noCacheRead?: boolean;
  /** Override the task's model list. */
  models?: string[];
  /** Additional cache-key discriminator (e.g. userId for personalized replies). */
  cacheScope?: string;
  /** Ask model for strict JSON. */
  responseJson?: boolean;
  /** Override maxTokens from task registry. */
  maxTokens?: number;
  /** Signed-in user for rate limiting / logging. */
  userId?: string | null;
  role?: "admin" | "student";
  /** Skip rate limit (system calls). */
  systemCall?: boolean;
};

export type AiCallResult = {
  text: string;
  cached: boolean;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
};

/** Main entrypoint for text/multimodal AI calls. */
export async function callAI(
  taskType: TaskType,
  messages: AiMessage[],
  opts: CallAiOptions = {},
): Promise<AiCallResult> {
  const task = getTask(taskType);
  const models = opts.models ?? modelsForTier(task.tier);
  const maxTokens = opts.maxTokens ?? task.maxTokens;

  // --- 1. Cache lookup ---
  let cacheKey: string | null = null;
  if (task.cacheable) {
    cacheKey = await buildCacheKey(taskType, { messages, models, responseJson: opts.responseJson }, opts.cacheScope);
    if (!opts.noCacheRead) {
      const hit = await readCache<{ text: string; model?: string; tokensIn?: number; tokensOut?: number }>(cacheKey);
      if (hit && typeof hit.text === "string") {
        // Log cache hit (0 latency, 0 tokens billed) — NOT charged to quota.
        logUsage({
          taskType,
          modelTier: task.tier,
          model: hit.model ?? null,
          cacheHit: true,
          tokensIn: 0,
          tokensOut: 0,
          latencyMs: 0,
          success: true,
          userId: opts.userId ?? null,
          feature: taskToFeature(taskType),
          charged: false,
        });

        return { text: hit.text, cached: true, model: hit.model ?? null, tokensIn: 0, tokensOut: 0, latencyMs: 0 };
      }
    }
  }

  // --- 2. Rate limit + duplicate guard + quota reservation ---
  const feature = taskToFeature(taskType);
  let quotaPeriod: "daily" | "weekly" | "monthly" | null = null;
  if (!opts.systemCall && opts.userId) {
    await enforceRateLimit(opts.userId, opts.role ?? "student", task.rateWeight ?? 1);
    const reqHash = await hashRequest(taskType, messages);
    await guardDuplicate(opts.userId, reqHash);
    if (feature) {
      const { quota } = await checkQuota(opts.userId, opts.role ?? "student", feature);
      quotaPeriod = quota.period;
    }
  }


  // --- 3. Provider chain ---
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY غير مضبوط");

  const start = Date.now();
  let lastErr: any = null;

  for (const model of models) {
    try {
      const body: Record<string, unknown> = { model, messages, max_tokens: maxTokens };
      if (task.temperature != null) body.temperature = task.temperature;
      if (opts.responseJson) body.response_format = { type: "json_object" };
      if (model.startsWith("openai/gpt-5.6")) body.reasoning_effort = "none";

      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify(body),
      });

      if (res.status === 429) { lastErr = new Error("تجاوز حد الاستخدام (429)"); continue; }
      if (res.status === 402) { lastErr = new Error("انتهى رصيد الذكاء الاصطناعي (402)"); continue; }
      if (!res.ok) {
        const t = await res.text();
        lastErr = new Error(`AI ${res.status}: ${t.slice(0, 300)}`);
        continue;
      }
      const json = (await res.json()) as any;
      const text = json?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) { lastErr = new Error("رد فارغ من AI"); continue; }

      const tokensIn = Number(json?.usage?.prompt_tokens ?? 0);
      const tokensOut = Number(json?.usage?.completion_tokens ?? 0);
      const latencyMs = Date.now() - start;

      // --- 4. Cache write ---
      if (cacheKey) {
        await writeCache({
          cacheKey,
          taskType,
          model,
          provider: "lovable",
          result: { text, model, tokensIn, tokensOut },
          tokensIn,
          tokensOut,
          ttlSeconds: task.ttl,
        });
      }

      // --- 5. Log usage + commit quota ---
      logUsage({
        taskType,
        modelTier: task.tier,
        model,
        cacheHit: false,
        tokensIn,
        tokensOut,
        latencyMs,
        success: true,
        userId: opts.userId ?? null,
        feature,
        charged: !!(feature && !opts.systemCall && opts.userId),
      });
      if (feature && quotaPeriod && !opts.systemCall && opts.userId) {
        void commitQuotaUsage(opts.userId, feature, quotaPeriod);
      }

      return { text, cached: false, model, tokensIn, tokensOut, latencyMs };
    } catch (e: any) {
      lastErr = e;
    }
  }

  logUsage({
    taskType,
    modelTier: task.tier,
    model: null,
    cacheHit: false,
    tokensIn: 0,
    tokensOut: 0,
    latencyMs: Date.now() - start,
    success: false,
    userId: opts.userId ?? null,
    error: lastErr?.message?.slice(0, 200),
    feature,
    charged: false,
  });
  throw lastErr ?? new Error("فشلت جميع محاولات مزودي الذكاء الاصطناعي");
}


/** Fire-and-forget usage logger. Never throws. */
function logUsage(opts: {
  taskType: string;
  modelTier: string;
  model: string | null;
  cacheHit: boolean;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  success: boolean;
  userId?: string | null;
  error?: string;
}) {
  (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const cost = opts.model ? estimateCost(opts.model, opts.tokensIn, opts.tokensOut) : 0;
      await supabaseAdmin.from("ai_usage_logs").insert({
        function_name: opts.taskType,
        function_key: opts.taskType,
        task_type: opts.taskType,
        model_tier: opts.modelTier,
        model: opts.model,
        cache_hit: opts.cacheHit,
        tokens_in: opts.tokensIn,
        tokens_out: opts.tokensOut,
        tokens_used: opts.tokensIn + opts.tokensOut,
        estimated_cost: cost,
        latency_ms: opts.latencyMs,
        success: opts.success,
        error: opts.error ?? null,
        user_id: opts.userId ?? null,
      });
    } catch {}
  })();
}

/** Convenience: parse JSON reply loosely (strips markdown fences). */
export function parseJsonReply<T = unknown>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]) as T;
  throw new Error("تعذّر تحليل رد AI كـ JSON");
}
