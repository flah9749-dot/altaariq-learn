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

export function normalizeAnswerText(s: any): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ـ]/g, "")
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function simplifyAnswerText(s: string): string {
  const ignored = new Set(["في", "على", "من", "الي", "الى", "عن", "ما", "اسم", "هذا", "هذه", "هو", "هي"]);
  return s
    .split(" ")
    .map((word) => (word.startsWith("ال") && word.length > 3 ? word.slice(2) : word))
    .filter((word) => word && !ignored.has(word))
    .join(" ");
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function splitExpectedAnswers(expected: any): string[] {
  return String(expected ?? "")
    .split(/\s*(?:[،,؛;|/]|\bاو\b|\bأو\b)\s*/)
    .map(normalizeAnswerText)
    .filter(Boolean);
}

export function textAnswerMatches(expected: any, given: any): boolean {
  const normalizedGiven = normalizeAnswerText(given);
  if (!normalizedGiven) return false;
  const simplifiedGiven = simplifyAnswerText(normalizedGiven);
  const compactGiven = simplifiedGiven.replace(/\s+/g, "");

  return splitExpectedAnswers(expected).some((normalizedExpected) => {
    if (!normalizedExpected) return false;
    const simplifiedExpected = simplifyAnswerText(normalizedExpected);
    const compactExpected = simplifiedExpected.replace(/\s+/g, "");
    if (normalizedExpected === normalizedGiven || simplifiedExpected === simplifiedGiven) return true;
    if (normalizedGiven.length >= 3 && normalizedExpected.includes(normalizedGiven)) return true;
    if (normalizedExpected.length >= 3 && normalizedGiven.includes(normalizedExpected)) return true;
    if (simplifiedGiven.length >= 3 && simplifiedExpected.includes(simplifiedGiven)) return true;
    if (simplifiedExpected.length >= 3 && simplifiedGiven.includes(simplifiedExpected)) return true;
    if (compactExpected.length >= 4 && compactGiven.length >= 4) {
      const maxDistance = Math.max(compactExpected.length, compactGiven.length) >= 8 ? 2 : 1;
      return editDistance(compactExpected, compactGiven) <= maxDistance;
    }
    return false;
  });
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
      const ok = textAnswerMatches(sq.answer, ans);
      return { correct: ok, points: ok ? pts : 0 };
    }
  }
  return { correct: null, points: 0 };
}
