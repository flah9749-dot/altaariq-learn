// Server-only helper for calling Lovable AI Gateway with fallback.
// Do NOT import from client-reachable code (marked .server.ts).

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Default model priority: cost-efficient multimodal → stronger fallback.
export const DEFAULT_MODEL_CHAIN = [
  "google/gemini-3.5-flash",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5.4-mini",
];

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

export type CallOptions = {
  models?: string[];
  temperature?: number;
  responseJson?: boolean;
  maxTokens?: number;
};

export async function callLovableChat(messages: ChatMessage[], opts: CallOptions = {}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY غير مضبوط");
  const chain = opts.models ?? DEFAULT_MODEL_CHAIN;
  let lastErr: any = null;

  for (const model of chain) {
    try {
      const body: Record<string, unknown> = { model, messages };
      if (opts.temperature != null) body.temperature = opts.temperature;
      if (opts.responseJson) body.response_format = { type: "json_object" };
      if (opts.maxTokens) body.max_tokens = opts.maxTokens;
      if (model.startsWith("openai/gpt-5.6")) body.reasoning_effort = "none";

      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        lastErr = new Error("تم تجاوز حد الاستخدام (429)");
        continue;
      }
      if (res.status === 402) {
        lastErr = new Error("انتهى رصيد الذكاء الاصطناعي (402). أضف رصيدًا للاستمرار.");
        continue;
      }
      if (!res.ok) {
        const t = await res.text();
        lastErr = new Error(`AI ${res.status}: ${t.slice(0, 300)}`);
        continue;
      }
      const json = (await res.json()) as any;
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        lastErr = new Error("رد فارغ من AI");
        continue;
      }
      return content;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("فشلت جميع محاولات مزودي الذكاء الاصطناعي");
}

export function parseJsonLoose<T = unknown>(text: string): T {
  // Strip markdown fences if present.
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  // Fallback: extract first { ... } block
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]) as T;
  throw new Error("تعذّر تحليل رد AI كـ JSON");
}

// Generate an image via Lovable AI Gateway (chat-shape Gemini image model).
// Returns a data URL string (data:image/...;base64,...) or null on failure.
export async function generateImageViaGateway(prompt: string, opts: { model?: string } = {}): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const model = opts.model ?? "google/gemini-2.5-flash-image-preview";
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const msg = json?.choices?.[0]?.message;
    const imgs = msg?.images;
    if (Array.isArray(imgs) && imgs[0]?.image_url?.url) return String(imgs[0].image_url.url);
    // Some providers return the image inline in content parts
    const parts = Array.isArray(msg?.content) ? msg.content : [];
    for (const p of parts) {
      if (p?.type === "image_url" && p?.image_url?.url) return String(p.image_url.url);
    }
    return null;
  } catch {
    return null;
  }
}
