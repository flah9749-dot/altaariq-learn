// Multi-provider AI dispatcher with automatic fallback.
// Server-only. Reads keys from process.env (Secrets).

export type ProviderSlug =
  | "lovable" | "gemini" | "openai" | "claude" | "groq"
  | "deepseek" | "mistral" | "openrouter";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export type ProviderResult = {
  provider: ProviderSlug;
  content: string;
  latencyMs: number;
};

const SECRET: Record<ProviderSlug, string> = {
  lovable: "LOVABLE_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const DEFAULT_MODEL: Record<ProviderSlug, string> = {
  lovable: "google/gemini-3.5-flash",
  gemini: "gemini-2.0-flash-exp",
  openai: "gpt-4o-mini",
  claude: "claude-3-5-sonnet-20241022",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  mistral: "mistral-small-latest",
  openrouter: "openai/gpt-4o-mini",
};

export const FALLBACK_ORDER: ProviderSlug[] = [
  "lovable", "gemini", "openai", "claude", "groq", "deepseek", "mistral", "openrouter",
];

export function getEnvKey(slug: ProviderSlug): string | undefined {
  const v = process.env[SECRET[slug]];
  return v && v.trim() ? v.trim() : undefined;
}

// DB overrides (ai_api_keys). Short in-memory cache so hot paths stay fast.
type KeyCacheEntry = { value: string | null; at: number };
const DB_KEY_CACHE = new Map<ProviderSlug, KeyCacheEntry>();
const DB_KEY_TTL_MS = 30_000;

export function invalidateKeyCache(slug?: ProviderSlug) {
  if (slug) DB_KEY_CACHE.delete(slug);
  else DB_KEY_CACHE.clear();
}

async function getDbKey(slug: ProviderSlug): Promise<string | null> {
  const cached = DB_KEY_CACHE.get(slug);
  if (cached && Date.now() - cached.at < DB_KEY_TTL_MS) return cached.value;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prov } = await supabaseAdmin.from("ai_providers").select("id").eq("slug", slug).maybeSingle();
    if (!prov?.id) { DB_KEY_CACHE.set(slug, { value: null, at: Date.now() }); return null; }
    const { data: row } = await supabaseAdmin.from("ai_api_keys")
      .select("encrypted_key, enabled").eq("provider_id", prov.id).eq("enabled", true)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const value = row?.encrypted_key && row.encrypted_key.trim() ? row.encrypted_key.trim() : null;
    DB_KEY_CACHE.set(slug, { value, at: Date.now() });
    return value;
  } catch {
    DB_KEY_CACHE.set(slug, { value: null, at: Date.now() });
    return null;
  }
}

export async function getKey(slug: ProviderSlug): Promise<string | undefined> {
  const db = await getDbKey(slug);
  if (db) return db;
  return getEnvKey(slug);
}

export async function hasKey(slug: ProviderSlug): Promise<boolean> {
  return !!(await getKey(slug));
}


const TIMEOUT_MS = 30_000;
function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// ---------- Individual provider calls ----------

async function callOpenAILike(
  url: string, key: string, model: string, messages: ChatMsg[], responseJson?: boolean,
): Promise<string> {
  const body: any = { model, messages };
  if (responseJson) body.response_format = { type: "json_object" };
  const isLovable = url.includes("ai.gateway.lovable.dev");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isLovable) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["Lovable-API-Key"] = key;
  } else {
    headers["Authorization"] = `Bearer ${key}`;
  }
  const res = await withTimeout(fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }));
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const j: any = await res.json();
  const c = j?.choices?.[0]?.message?.content;
  if (!c || typeof c !== "string") throw new Error("Empty response");
  return c;
}

async function callGemini(key: string, model: string, messages: ChatMsg[], responseJson?: boolean): Promise<string> {
  const sys = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
  const contents = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = { contents };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  if (responseJson) body.generationConfig = { responseMimeType: "application/json" };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await withTimeout(fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const j: any = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Empty response");
  return text;
}

async function callClaude(key: string, model: string, messages: ChatMsg[]): Promise<string> {
  const sys = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
  const msgs = messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
  const res = await withTimeout(fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 2048, system: sys || undefined, messages: msgs }),
  }));
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const j: any = await res.json();
  const text = j?.content?.[0]?.text;
  if (!text) throw new Error("Empty response");
  return text;
}

export async function callProvider(
  slug: ProviderSlug,
  messages: ChatMsg[],
  opts: { model?: string; responseJson?: boolean } = {},
): Promise<string> {
  const key = await getKey(slug);
  if (!key) throw new Error(`مفتاح ${slug} غير مضبوط`);

  const model = opts.model ?? DEFAULT_MODEL[slug];
  switch (slug) {
    case "lovable":
      return callOpenAILike("https://ai.gateway.lovable.dev/v1/chat/completions", key, model, messages, opts.responseJson);
    case "gemini":
      return callGemini(key, model, messages, opts.responseJson);
    case "openai":
      return callOpenAILike("https://api.openai.com/v1/chat/completions", key, model, messages, opts.responseJson);
    case "claude":
      return callClaude(key, model, messages);
    case "groq":
      return callOpenAILike("https://api.groq.com/openai/v1/chat/completions", key, model, messages, opts.responseJson);
    case "deepseek":
      return callOpenAILike("https://api.deepseek.com/v1/chat/completions", key, model, messages, opts.responseJson);
    case "mistral":
      return callOpenAILike("https://api.mistral.ai/v1/chat/completions", key, model, messages, opts.responseJson);
    case "openrouter":
      return callOpenAILike("https://openrouter.ai/api/v1/chat/completions", key, model, messages, opts.responseJson);
    default:
      throw new Error(`Unknown provider: ${slug}`);
  }
}

// ---------- Test connection ----------
export async function testProviderConnection(slug: ProviderSlug): Promise<{ ok: boolean; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    if (!hasKey(slug)) return { ok: false, error: "المفتاح غير مضبوط في Secrets", latencyMs: 0 };
    await callProvider(slug, [{ role: "user", content: "قل كلمة: تم" }]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { ok: false, error: interpretError(e?.message ?? String(e)), latencyMs: Date.now() - start };
  }
}

function interpretError(msg: string): string {
  if (/401|403|invalid|unauthor/i.test(msg)) return "مفتاح API غير صحيح أو غير مصرح";
  if (/429|rate/i.test(msg)) return "تجاوز حد الاستخدام (Rate Limit)";
  if (/402|quota|insufficient|credit/i.test(msg)) return "الرصيد منتهي";
  if (/timeout/i.test(msg)) return "انتهت مهلة الاتصال (Timeout)";
  if (/network|fetch/i.test(msg)) return "خطأ اتصال بالشبكة";
  return msg.slice(0, 200);
}

// ---------- Usage logging ----------
const providerIdCache = new Map<ProviderSlug, string>();
async function resolveProviderId(slug: ProviderSlug): Promise<string | null> {
  if (providerIdCache.has(slug)) return providerIdCache.get(slug)!;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("ai_providers").select("id").eq("slug", slug).maybeSingle();
    if (data?.id) { providerIdCache.set(slug, data.id); return data.id; }
  } catch {}
  return null;
}

export async function logAIUsage(opts: {
  slug?: ProviderSlug;
  function_name: string;
  function_key?: string;
  success: boolean;
  latency_ms?: number;
  error?: string | null;
  tokens_used?: number;
}): Promise<void> {
  try {
    const provider_id = opts.slug ? await resolveProviderId(opts.slug) : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage_logs").insert({
      provider_id,
      function_name: opts.function_name,
      function_key: opts.function_key ?? null,
      success: opts.success,
      latency_ms: opts.latency_ms ?? null,
      error: opts.error ?? null,
      tokens_used: opts.tokens_used ?? 0,
    });
    if (provider_id) {
      // Increment aggregate counters on ai_providers
      const patch: any = { last_used_at: new Date().toISOString() };
      const { data: cur } = await supabaseAdmin.from("ai_providers")
        .select("requests_count, errors_count, avg_latency_ms").eq("id", provider_id).maybeSingle();
      const reqs = (cur?.requests_count ?? 0) + 1;
      const errs = (cur?.errors_count ?? 0) + (opts.success ? 0 : 1);
      patch.requests_count = reqs;
      patch.errors_count = errs;
      if (opts.latency_ms && opts.success) {
        const prev = cur?.avg_latency_ms ?? 0;
        patch.avg_latency_ms = Math.round(((prev * (reqs - 1)) + opts.latency_ms) / reqs);
      }
      await supabaseAdmin.from("ai_providers").update(patch).eq("id", provider_id);
    }
  } catch {}
}

// ---------- Dispatch with fallback ----------
export async function dispatchWithFallback(
  preferred: ProviderSlug,
  messages: ChatMsg[],
  opts: { responseJson?: boolean; function_name?: string } = {},
): Promise<ProviderResult> {
  const chain = [preferred, ...FALLBACK_ORDER.filter(p => p !== preferred)];
  let lastErr: any = null;
  const fnName = opts.function_name ?? "dispatch";
  for (const p of chain) {
    if (!hasKey(p)) continue;
    const start = Date.now();
    try {
      const content = await callProvider(p, messages, opts);
      const latency = Date.now() - start;
      await logAIUsage({ slug: p, function_name: fnName, success: true, latency_ms: latency });
      return { provider: p, content, latencyMs: latency };
    } catch (e: any) {
      lastErr = e;
      await logAIUsage({ slug: p, function_name: fnName, success: false, latency_ms: Date.now() - start, error: e?.message?.slice(0, 200) });
    }
  }
  throw new Error(lastErr?.message ?? "لا يوجد مزود ذكاء اصطناعي متاح");
}
