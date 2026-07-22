export const QUESTION_TYPES = [
  { value: "mcq", label: "اختيار من متعدد" },
  { value: "true_false", label: "صح أو خطأ" },
  { value: "complete", label: "أكمل" },
  { value: "map", label: "سؤال خريطة" },
  { value: "order", label: "ترتيب العناصر" },
  { value: "match", label: "توصيل" },
  { value: "essay", label: "مقالي" },
] as const;

export type QuestionType = typeof QUESTION_TYPES[number]["value"];

export const isObjective = (t: string) => ["mcq", "true_false", "complete", "order", "match", "map"].includes(t);

export function computeGrade(pct: number): string {
  if (pct >= 95) return "ممتاز مرتفع";
  if (pct >= 85) return "ممتاز";
  if (pct >= 75) return "جيد جدًا";
  if (pct >= 65) return "جيد";
  if (pct >= 50) return "مقبول";
  return "ضعيف";
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type ExamStatus = "draft" | "published" | "scheduled" | "ended";

export function deriveStatus(exam: { published: boolean; starts_at: string | null; ends_at: string | null; status?: string | null }): ExamStatus {
  if (!exam.published) return "draft";
  const now = new Date();
  if (exam.ends_at && new Date(exam.ends_at) < now) return "ended";
  if (exam.starts_at && new Date(exam.starts_at) > now) return "scheduled";
  return "published";
}

export const STATUS_LABEL: Record<ExamStatus, string> = {
  draft: "مسودة",
  published: "منشور",
  scheduled: "مجدول",
  ended: "منتهي",
};

export const STATUS_COLOR: Record<ExamStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success text-success-foreground",
  scheduled: "bg-warning text-warning-foreground",
  ended: "bg-destructive text-destructive-foreground",
};

// ---------------- Map sub-questions (multi-question per marker) ----------------
export type MapSubQuestionType = "short" | "mcq" | "true_false" | "complete" | "essay";

export type MapSubQuestion = {
  id: string;
  type: MapSubQuestionType;
  text: string;
  answer?: string;
  options?: Array<{ text: string; is_correct: boolean }>;
  points: number;
};

export const MAP_SUB_QUESTION_TYPES: Array<{ value: MapSubQuestionType; label: string }> = [
  { value: "short", label: "إجابة قصيرة" },
  { value: "mcq", label: "اختيار من متعدد" },
  { value: "true_false", label: "صح/خطأ" },
  { value: "complete", label: "إكمال" },
  { value: "essay", label: "مقالي" },
];

export function makeMapSubQuestion(type: MapSubQuestionType = "short"): MapSubQuestion {
  const id = `sq_${Math.random().toString(36).slice(2, 10)}`;
  const base: MapSubQuestion = { id, type, text: "", answer: "", points: 1 };
  if (type === "mcq") base.options = [
    { text: "", is_correct: true },
    { text: "", is_correct: false },
  ];
  if (type === "true_false") base.answer = "true";
  return base;
}

function normArabic(s: any): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

export function evalMapSubQuestion(
  sq: MapSubQuestion,
  ans: any,
): { correct: boolean | null; points: number; needsReview?: boolean } {
  const pts = Math.max(0, Number(sq.points) || 0);
  if (sq.type === "essay") return { correct: null, points: 0, needsReview: true };
  if (ans == null || ans === "") return { correct: null, points: 0 };
  switch (sq.type) {
    case "mcq": {
      const correctIdx = (sq.options ?? []).findIndex((o) => o.is_correct);
      const ok = correctIdx >= 0 && Number(ans) === correctIdx;
      return { correct: ok, points: ok ? pts : 0 };
    }
    case "true_false": {
      const ok = String(ans) === String(sq.answer ?? "true");
      return { correct: ok, points: ok ? pts : 0 };
    }
    case "short":
    case "complete": {
      const expected = normArabic(sq.answer);
      const given = normArabic(ans);
      const ok = !!expected && (expected === given || expected.includes(given) || given.includes(expected));
      return { correct: ok, points: ok ? pts : 0 };
    }
  }
  return { correct: null, points: 0 };
}
