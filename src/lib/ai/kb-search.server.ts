// Semantic retrieval over the knowledge base + context building for the assistant.

import { embedOne } from "./embeddings.server";

export type KbHit = {
  id: string;
  documentId: string;
  title: string;
  docType: string;
  unit: string | null;
  lesson: string | null;
  heading: string | null;
  pageNumber: number | null;
  content: string;
  similarity: number;
};

export type KbSource = {
  title: string;
  unit: string | null;
  lesson: string | null;
  page: number | null;
  similarity: number;
};

/** Nearest chunks for a question, optionally scoped to the student's class. */
export async function searchKnowledge(opts: {
  question: string;
  classId?: string | null;
  docType?: string | null;
  limit?: number;
  minSimilarity?: number;
}): Promise<KbHit[]> {
  const query = opts.question.trim();
  if (query.length < 3) return [];

  let embedding: number[];
  try {
    embedding = await embedOne(query);
  } catch {
    return [];
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("match_kb_chunks", {
      query_embedding: JSON.stringify(embedding) as any,
      match_count: opts.limit ?? 6,
      filter_class_id: opts.classId ?? null,
      filter_doc_type: opts.docType ?? null,
      min_similarity: opts.minSimilarity ?? 0.32,
    } as any);
    if (error) return [];
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      documentId: r.document_id,
      title: r.title,
      docType: r.doc_type,
      unit: r.unit,
      lesson: r.lesson,
      heading: r.heading,
      pageNumber: r.page_number,
      content: r.content,
      similarity: Number(r.similarity ?? 0),
    }));
  } catch {
    return [];
  }
}

/** Retrieval quality signal used to decide "answer" vs "ask the teacher". */
export function confidenceOf(hits: KbHit[]): number {
  if (!hits.length) return 0;
  const top = hits[0].similarity;
  const support = Math.min(hits.length, 3) / 3;
  return top * 0.75 + support * 0.25;
}

/** Render retrieved chunks as a compact context block for the model. */
export function buildContextBlock(hits: KbHit[], maxChars = 7000): string {
  const parts: string[] = [];
  let used = 0;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const label = [h.title, h.unit, h.lesson, h.pageNumber ? `صفحة ${h.pageNumber}` : null]
      .filter(Boolean)
      .join(" • ");
    const block = `[مصدر ${i + 1}] ${label}\n${h.content}`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n\n---\n\n");
}

export function toSources(hits: KbHit[]): KbSource[] {
  const seen = new Set<string>();
  const out: KbSource[] = [];
  for (const h of hits) {
    const key = `${h.title}|${h.unit ?? ""}|${h.lesson ?? ""}|${h.pageNumber ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: h.title, unit: h.unit, lesson: h.lesson, page: h.pageNumber, similarity: h.similarity });
  }
  return out.slice(0, 5);
}

const AR_ORDINALS: Record<string, number> = {
  "الأول": 1, "الاول": 1, "الأولى": 1, "الاولى": 1,
  "الثاني": 2, "الثانية": 2, "التاني": 2,
  "الثالث": 3, "الثالثة": 3, "التالت": 3,
  "الرابع": 4, "الرابعة": 4,
  "الخامس": 5, "الخامسة": 5,
  "السادس": 6, "السادسة": 6,
  "السابع": 7, "السابعة": 7,
  "الثامن": 8, "الثامنة": 8,
};

function ordinalOf(token: string): number | null {
  const t = token.trim();
  if (/^\d+$/.test(t)) return Number(t);
  return AR_ORDINALS[t] ?? null;
}

export type KbScope = {
  /** unit / term number ("الفصل الأول" / "الوحدة الثانية") */
  unit: number | null;
  /** lesson number ("الدرس الأول") */
  lesson: number | null;
  /** grade name fragment ("الأول الإعدادي") */
  gradeHint: string | null;
};

/** Understand requests like "امتحان من الفصل الأول للصف الأول الإعدادي". */
export function parseScope(text: string): KbScope {
  const q = text.replace(/\s+/g, " ");
  const unitM = q.match(/(?:الوحدة|الوحده|الفصل|الباب|الترم)\s+(\S+)/);
  const lessonM = q.match(/(?:الدرس|الموضوع)\s+(\S+)/);
  const gradeM = q.match(/الصف\s+(\S+(?:\s+(?:الإعدادي|الاعدادي|الثانوي|الابتدائي))?)/);
  return {
    unit: unitM ? ordinalOf(unitM[1]) : null,
    lesson: lessonM ? ordinalOf(lessonM[1]) : null,
    gradeHint: gradeM ? gradeM[1] : null,
  };
}

/** Keep only hits whose unit/lesson labels match the requested scope (when any match). */
export function applyScope(hits: KbHit[], scope: KbScope): KbHit[] {
  if (scope.unit == null && scope.lesson == null) return hits;
  const matches = (label: string | null, n: number | null) => {
    if (n == null) return true;
    if (!label) return false;
    const digits = label.match(/\d+/);
    if (digits && Number(digits[0]) === n) return true;
    const words = Object.entries(AR_ORDINALS).filter(([, v]) => v === n).map(([k]) => k);
    return words.some((w) => label.includes(w));
  };
  const filtered = hits.filter((h) => matches(h.unit, scope.unit) && matches(h.lesson, scope.lesson));
  return filtered.length ? filtered : hits;
}

/** The student's class, read from their profile — never asked in chat. */
export async function getStudentClass(userId: string): Promise<{ studentId: string | null; classId: string | null; className: string | null }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("students")
      .select("id, class_id, classes(name)")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return { studentId: null, classId: null, className: null };
    return {
      studentId: (data as any).id ?? null,
      classId: (data as any).class_id ?? null,
      className: (data as any).classes?.name ?? null,
    };
  } catch {
    return { studentId: null, classId: null, className: null };
  }
}

