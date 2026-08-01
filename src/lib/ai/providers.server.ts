// Unified OpenAI-compatible provider layer.
// Every provider (OpenRouter / Together / Ollama / custom endpoint / Lovable)
// is described by a row in `ai_providers`: slug, base_url, default_model,
// enabled, priority. The API key comes from `ai_api_keys` (DB) or a Secret.
//
// The router asks for `getProviderChain()` and calls them in priority order.

export type ProviderConfig = {
  slug: string;
  name: string;
  baseUrl: string;
  model: string | null;
  priority: number;
  apiKey: string;
};

const DEFAULT_BASE_URL: Record<string, string> = {
  lovable: "https://ai.gateway.lovable.dev/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  together: "https://api.together.xyz/v1/chat/completions",
  ollama: "http://localhost:11434/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
};

/** Cheap, strong, Arabic-capable defaults per provider. */
export const DEFAULT_MODELS: Record<string, string> = {
  openrouter: "qwen/qwen-2.5-72b-instruct",
  together: "Qwen/Qwen2.5-72B-Instruct-Turbo",
  ollama: "qwen2.5:7b-instruct",
};

let CHAIN_CACHE: { at: number; chain: ProviderConfig[] } | null = null;
const CHAIN_TTL_MS = 30_000;

export function invalidateProviderChain() {
  CHAIN_CACHE = null;
}

/**
 * Enabled, key-bearing, OpenAI-compatible providers ordered by priority.
 * Lovable is excluded here — the router always keeps it as the final safety net.
 */
export async function getProviderChain(): Promise<ProviderConfig[]> {
  if (CHAIN_CACHE && Date.now() - CHAIN_CACHE.at < CHAIN_TTL_MS) return CHAIN_CACHE.chain;

  const chain: ProviderConfig[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("ai_providers")
      .select("id, slug, name, enabled, priority, base_url, default_model, secret_name")
      .eq("enabled", true)
      .order("priority", { ascending: true });

    for (const row of (rows ?? []) as any[]) {
      if (row.slug === "lovable") continue;
      const baseUrl = (row.base_url as string | null) ?? DEFAULT_BASE_URL[row.slug] ?? null;
      if (!baseUrl) continue;
      // Non OpenAI-compatible providers (gemini native / claude) stay on the legacy dispatcher.
      if (row.slug === "gemini" || row.slug === "claude") continue;

      const apiKey = await resolveKey(row.id as string, row.secret_name as string | null, row.slug as string);
      if (!apiKey && row.slug !== "ollama") continue;

      chain.push({
        slug: row.slug,
        name: row.name,
        baseUrl,
        model: (row.default_model as string | null) ?? DEFAULT_MODELS[row.slug] ?? null,
        priority: row.priority ?? 99,
        apiKey: apiKey ?? "ollama",
      });
    }
  } catch {
    // DB unreachable → router falls back to Lovable.
  }

  CHAIN_CACHE = { at: Date.now(), chain };
  return chain;
}

async function resolveKey(providerId: string, secretName: string | null, slug: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_api_keys")
      .select("encrypted_key")
      .eq("provider_id", providerId)
      .eq("enabled", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dbKey = (data as any)?.encrypted_key;
    if (dbKey && String(dbKey).trim()) return String(dbKey).trim();
  } catch {}

  const envName = secretName ?? `${slug.toUpperCase()}_API_KEY`;
  const envKey = process.env[envName];
  return envKey && envKey.trim() ? envKey.trim() : null;
}

export type ChatCallInput = {
  messages: Array<{ role: string; content: unknown }>;
  maxTokens?: number;
  temperature?: number;
  responseJson?: boolean;
};

export type ChatCallResult = { text: string; tokensIn: number; tokensOut: number; model: string };

/** Single OpenAI-compatible chat call with a hard timeout. */
export async function callOpenAiCompatible(
  provider: ProviderConfig,
  input: ChatCallInput,
  timeoutMs = 60_000,
): Promise<ChatCallResult> {
  const model = provider.model;
  if (!model) throw new Error(`لم يُحدَّد نموذج للمزود ${provider.slug}`);

  const body: Record<string, unknown> = { model, messages: input.messages };
  if (input.maxTokens) body.max_tokens = input.maxTokens;
  if (input.temperature != null) body.temperature = input.temperature;
  if (input.responseJson) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.slug === "lovable") headers["Lovable-API-Key"] = provider.apiKey;
  else headers["Authorization"] = `Bearer ${provider.apiKey}`;
  if (provider.slug === "openrouter") {
    headers["HTTP-Referer"] = "https://altaariq-learn.lovable.app";
    headers["X-Title"] = "Al-Taariq Learning";
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(provider.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`${provider.slug} ${res.status}: ${t.slice(0, 250)}`);
    }
    const json = (await res.json()) as any;
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error(`رد فارغ من ${provider.slug}`);
    return {
      text,
      tokensIn: Number(json?.usage?.prompt_tokens ?? 0),
      tokensOut: Number(json?.usage?.completion_tokens ?? 0),
      model,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Admin "test connection" for any configured provider. */
export async function testProvider(slug: string): Promise<{ ok: boolean; error?: string; latencyMs: number; model?: string }> {
  const start = Date.now();
  try {
    invalidateProviderChain();
    const chain = await getProviderChain();
    const p = chain.find((c) => c.slug === slug);
    if (!p) return { ok: false, error: "المزود غير مفعّل أو بدون مفتاح/عنوان", latencyMs: 0 };
    const r = await callOpenAiCompatible(p, {
      messages: [{ role: "user", content: "قل كلمة: تم" }],
      maxTokens: 16,
    }, 20_000);
    return { ok: true, latencyMs: Date.now() - start, model: r.model };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 250), latencyMs: Date.now() - start };
  }
}
