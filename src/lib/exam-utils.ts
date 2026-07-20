export const QUESTION_TYPES = [
  { value: "mcq", label: "اختيار من متعدد" },
  { value: "true_false", label: "صح أو خطأ" },
  { value: "complete", label: "أكمل" },
  { value: "order", label: "ترتيب العناصر" },
  { value: "match", label: "توصيل" },
  { value: "essay", label: "مقالي" },
] as const;

export type QuestionType = typeof QUESTION_TYPES[number]["value"];

export const isObjective = (t: string) => ["mcq", "true_false", "complete", "order", "match"].includes(t);

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
