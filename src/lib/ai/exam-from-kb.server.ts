// Builds exam-generation context out of the knowledge base and the question bank.

import { searchKnowledge, parseScope, applyScope, buildContextBlock, toSources } from "./kb-search.server";

export type KbExamContext = {
  context: string;
  sources: ReturnType<typeof toSources>;
  bankQuestions: any[];
  chunkCount: number;
};

/** Pull curriculum chunks (scoped by unit/lesson understood from the instruction) + bank entries. */
export async function collectExamContext(opts: {
  instruction: string;
  classId: string | null;
  documentId?: string | null;
  useBank: boolean;
  bankLimit?: number;
}): Promise<KbExamContext> {
  const scope = parseScope(opts.instruction);

  let rawHits = await searchKnowledge({
    question: opts.instruction,
    classId: opts.classId,
    limit: 24,
    minSimilarity: 0.2,
  });
  // Fallback 1: same query without the class filter / with a looser threshold.
  if (!rawHits.length) {
    rawHits = await searchKnowledge({
      question: opts.instruction,
      classId: null,
      limit: 24,
      minSimilarity: 0.05,
    });
  }
  let hits = applyScope(rawHits, scope);
  if (opts.documentId) {
    const only = hits.filter((h) => h.documentId === opts.documentId);
    if (only.length) hits = only;
  }
  hits = hits.slice(0, 14);

  // Fallback 2: semantic search unavailable (no embeddings / gateway down) —
  // read chunks straight from the selected document or class.
  if (!hits.length) {
    hits = await rawChunks({ documentId: opts.documentId ?? null, classId: opts.classId, scope });
  }

  let bankQuestions: any[] = [];
  if (opts.useBank) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let q = supabaseAdmin
        .from("question_bank")
        .select("id, title, question_type, content, difficulty, points, unit, chapter, topic, class_ids")
        .limit(opts.bankLimit ?? 40);
      if (opts.classId) q = q.contains("class_ids", [opts.classId]);
      const { data } = await q;
      bankQuestions = (data ?? []) as any[];
    } catch {
      bankQuestions = [];
    }
  }

  return {
    context: buildContextBlock(hits, 12000),
    sources: toSources(hits),
    bankQuestions,
    chunkCount: hits.length,
  };
}

export const EXAM_SCHEMA_HINT = `أعد ردًا بصيغة JSON فقط بالمخطط التالي بدون أي شرح خارج JSON:
{
  "title": "عنوان الامتحان",
  "questions": [
    {
      "type": "mcq | true_false | complete | essay | order | match",
      "text": "نص السؤال",
      "difficulty": "easy | medium | hard",
      "points": 1,
      "explanation": "شرح مختصر للإجابة",
      "options": [{"text": "...", "is_correct": true}],
      "correct_answer": ...
    }
  ]
}`;

export function normalizeGenerated(questions: any[], allowedTypes: string[], defaultPoints: number, totalScore: number | null) {
  const out = questions.map((q: any, i: number) => ({
    type: allowedTypes.includes(q?.type) ? q.type : allowedTypes[0] ?? "mcq",
    text: String(q?.text ?? ""),
    image_url: null,
    points: Number(q?.points ?? defaultPoints) || defaultPoints,
    explanation: q?.explanation ?? null,
    difficulty: q?.difficulty ?? null,
    order_index: i,
    correct_answer: q?.correct_answer ?? null,
    options: Array.isArray(q?.options)
      ? q.options.map((o: any, oi: number) => ({ text: String(o?.text ?? ""), is_correct: !!o?.is_correct, order_index: oi }))
      : [],
  }));

  if (totalScore && totalScore > 0 && out.length) {
    const sum = out.reduce((a, q) => a + (Number(q.points) || 0), 0) || out.length;
    const factor = totalScore / sum;
    let running = 0;
    out.forEach((q, idx) => {
      if (idx === out.length - 1) {
        q.points = Math.max(0.5, Math.round((totalScore - running) * 2) / 2);
      } else {
        q.points = Math.max(0.5, Math.round(q.points * factor * 2) / 2);
        running += q.points;
      }
    });
  }
  return out;
}
