// Multi-provider AI dispatcher with automatic fallback.
// Server-only. Reads keys from process.env (Secrets).

export type ProviderSlug =
  | "gemini" | "openai" | "claude" | "groq"
  | "deepseek" | "mistral" | "openrouter";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export type ProviderResult = {
  provider: ProviderSlug;
  content: string;
  latencyMs: number;
};

const SECRET: Record<ProviderSlug, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const DEFAULT_MODEL: Record<ProviderSlug, string> = {
  gemini: "gemini-2.0-flash-exp",
  openai: "gpt-4o-mini",
  claude: "claude-3-5-sonnet-20241022",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  mistral: "mistral-small-latest",
  openrouter: "openai/gpt-4o-mini",
};

export const FALLBACK_ORDER: ProviderSlug[] = [
  "gemini", "openai", "claude", "groq", "deepseek", "mistral", "openrouter",
];

export function getKey(slug: ProviderSlug): string | undefined {
  const v = process.env[SECRET[slug]];
  return v && v.trim() ? v.trim() : undefined;
}

export function hasKey(slug: ProviderSlug): boolean {
  return !!getKey(slug);
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
  const res = await withTimeout(fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
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
  const key = getKey(slug);
  if (!key) throw new Error(`مفتاح ${slug} غير مضبوط`);
  const model = opts.model ?? DEFAULT_MODEL[slug];
  switch (slug) {
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

// ---------- Dispatch with fallback ----------
export async function dispatchWithFallback(
  preferred: ProviderSlug,
  messages: ChatMsg[],
  opts: { responseJson?: boolean } = {},
): Promise<ProviderResult> {
  const chain = [preferred, ...FALLBACK_ORDER.filter(p => p !== preferred)];
  let lastErr: any = null;
  for (const p of chain) {
    if (!hasKey(p)) continue;
    const start = Date.now();
    try {
      const content = await callProvider(p, messages, opts);
      return { provider: p, content, latencyMs: Date.now() - start };
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw new Error(lastErr?.message ?? "لا يوجد مزود ذكاء اصطناعي متاح");
}
