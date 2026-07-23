// Central registry for all AI tasks in the platform.
// Each task declares its tier (light/heavy), cache policy, token budget,
// and preferred provider chain — so callers just say `taskType` and the
// router picks the right model.

export type TaskTier = "light" | "heavy" | "vision";

export type AiTask = {
  tier: TaskTier;
  cacheable: boolean;
  /** cache TTL in seconds; undefined = no cache */
  ttl?: number;
  /** max output tokens for the model call */
  maxTokens: number;
  temperature?: number;
  /** ordered model fallback list on Lovable Gateway (or use tier default) */
  models?: string[];
  /** rate limit tier: user default 20/min light, 6/min heavy */
  rateWeight?: number;
};

// Light = cheap/fast (chat, short answers, analytics summaries).
// Heavy = strong reasoning or multimodal.
export const LIGHT_MODELS = [
  "google/gemini-3.1-flash-lite",
  "google/gemini-3.5-flash",
  "google/gemini-2.5-flash-lite",
];

export const HEAVY_MODELS = [
  "google/gemini-2.5-pro",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3.5-flash",
];

export const VISION_MODELS = [
  "google/gemini-2.5-pro",
  "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-flash",
];

export const AI_TASKS = {
  // Chat / assistants — no cache (dynamic), light model, small context.
  student_assistant_chat: { tier: "light", cacheable: false, maxTokens: 1500, temperature: 0.55, rateWeight: 1 },
  admin_assistant_chat:   { tier: "light", cacheable: false, maxTokens: 1500, temperature: 0.5,  rateWeight: 1 },

  // Assistant with a file attached — vision/PDF model, cache per file+question.
  student_assistant_file: { tier: "vision", cacheable: true, ttl: 60 * 60 * 24 * 7, maxTokens: 3500, temperature: 0.4, rateWeight: 3 },
  admin_assistant_file:   { tier: "vision", cacheable: true, ttl: 60 * 60 * 24 * 7, maxTokens: 4000, temperature: 0.4, rateWeight: 3 },

  // Exam generation — heavy but very cacheable (same source PDF + settings).
  exam_generate:          { tier: "heavy", cacheable: true, ttl: 60 * 60 * 24 * 30, maxTokens: 6000, temperature: 0.3, rateWeight: 4 },

  // Essay grading — heavy, cache per (question, answer, criteria).
  essay_grading:          { tier: "heavy", cacheable: true, ttl: 60 * 60 * 24 * 30, maxTokens: 800, temperature: 0.2, rateWeight: 2 },

  // Map analysis — vision, cache per image.
  map_analysis:           { tier: "vision", cacheable: true, ttl: 60 * 60 * 24 * 30, maxTokens: 3000, temperature: 0.3, rateWeight: 4 },

  // Analytics (exam/student insights) — light model, cache 1h.
  exam_analytics:         { tier: "light", cacheable: true, ttl: 60 * 60, maxTokens: 1200, temperature: 0.5, rateWeight: 2 },
  student_analytics:      { tier: "light", cacheable: true, ttl: 60 * 60, maxTokens: 1200, temperature: 0.5, rateWeight: 2 },

  // Generic helpers.
  summarize:              { tier: "light", cacheable: true, ttl: 60 * 60 * 24 * 7, maxTokens: 800, temperature: 0.3, rateWeight: 1 },
  paraphrase:             { tier: "light", cacheable: true, ttl: 60 * 60 * 24 * 7, maxTokens: 800, temperature: 0.5, rateWeight: 1 },

  // History summarizer used internally by the context manager.
  chat_history_summary:   { tier: "light", cacheable: false, maxTokens: 400, temperature: 0.2, rateWeight: 1 },
} satisfies Record<string, AiTask>;

export type TaskType = keyof typeof AI_TASKS;

export function getTask(t: TaskType): AiTask {
  return AI_TASKS[t];
}

export function modelsForTier(tier: TaskTier): string[] {
  if (tier === "vision") return VISION_MODELS;
  if (tier === "heavy") return HEAVY_MODELS;
  return LIGHT_MODELS;
}

// Rough per-1K-token pricing in USD (indicative only, for admin dashboard).
export const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "google/gemini-3.1-flash-lite":     { in: 0.00010, out: 0.00040 },
  "google/gemini-3.5-flash":          { in: 0.00015, out: 0.00060 },
  "google/gemini-3.6-flash":          { in: 0.00015, out: 0.00060 },
  "google/gemini-2.5-flash":          { in: 0.00015, out: 0.00060 },
  "google/gemini-2.5-flash-lite":     { in: 0.00010, out: 0.00040 },
  "google/gemini-2.5-pro":            { in: 0.00125, out: 0.00500 },
  "google/gemini-3.1-pro-preview":    { in: 0.00125, out: 0.00500 },
  "openai/gpt-5.4-nano":              { in: 0.00020, out: 0.00080 },
  "openai/gpt-5.4-mini":              { in: 0.00050, out: 0.00200 },
  "openai/gpt-5.5":                   { in: 0.00300, out: 0.01200 },
};

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  return (tokensIn / 1000) * p.in + (tokensOut / 1000) * p.out;
}
