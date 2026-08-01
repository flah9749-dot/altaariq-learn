// Text embeddings via the Lovable AI Gateway (OpenAI-compatible /v1/embeddings).
// 1536 dims — matches the `vector(1536)` column on kb_chunks.

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
export const EMBED_MODEL = "openai/text-embedding-3-small";
export const EMBED_DIMS = 1536;

/** Max inputs we send in a single request (well under provider caps). */
const BATCH_SIZE = 64;

function apiKey(): string {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("مفتاح الذكاء الاصطناعي غير مضبوط (LOVABLE_API_KEY)");
  return k;
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey() },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("تجاوز حد الطلبات — أعد المحاولة بعد قليل (429)");
    if (res.status === 402) throw new Error("انتهى رصيد الذكاء الاصطناعي (402)");
    throw new Error(`فشل توليد البصمات الدلالية ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as any;
  const data = (json?.data ?? []) as Array<{ index: number; embedding: number[] }>;
  const out: number[][] = new Array(inputs.length);
  for (const d of data) out[d.index ?? 0] = d.embedding;
  for (let i = 0; i < inputs.length; i++) if (!out[i]) throw new Error("بصمة دلالية مفقودة");
  return out;
}

/** Embed one string. */
export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedBatch([normalize(text)]);
  return v;
}

/** Embed many strings, batched. Order is preserved. */
export async function embedMany(texts: string[]): Promise<number[][]> {
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE).map(normalize);
    const vectors = await embedBatch(slice);
    all.push(...vectors);
  }
  return all;
}

function normalize(t: string): string {
  const clean = t.replace(/\s+/g, " ").trim();
  // ~8k token cap for text-embedding-3-*; stay comfortably below it.
  return clean.length > 20_000 ? clean.slice(0, 20_000) : clean || "-";
}
