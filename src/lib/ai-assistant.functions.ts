import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI, type AiMessage } from "@/lib/ai/router.server";
import { trimHistory } from "@/lib/ai/context-manager.server";
import { hashDataUrl, lookupDocumentByHash, saveExtractedDocument, clampText } from "@/lib/ai/document-cache.server";

// Short, focused system prompt (was ~250 words → ~70 words).
const SYSTEM_PROMPT =
  "أنت مساعد المعلم في منصة الطارق التعليمية (دراسات اجتماعية). ردّ بالعربية الفصحى، منظماً بعناوين ونقاط. عند وجود مرفق اقرأ محتواه كاملاً واستخرج النصوص والأسئلة واشرحها. لا تعتذر عن قراءة الملفات.";

type Attachment = {
  kind: "image" | "file";
  mime: string;
  name?: string;
  dataUrl: string;
};

type UiMsg = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

type ChatInput = {
  messages: Array<UiMsg>;
  context?: string;
};

async function buildContent(m: UiMsg): Promise<AiMessage["content"]> {
  if (!m.attachments || m.attachments.length === 0) return m.content;
  const parts: Array<Record<string, unknown>> = [];
  if (m.content?.trim()) parts.push({ type: "text", text: m.content });
  for (const a of m.attachments) {
    // Try to reuse extracted text for previously-uploaded files.
    const hash = await hashDataUrl(a.dataUrl);
    if (hash) {
      const cached = await lookupDocumentByHash(hash);
      if (cached) {
        parts.push({ type: "text", text: `[محتوى الملف "${a.name ?? "file"}"]\n${clampText(cached.text)}` });
        continue;
      }
    }
    if (a.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
    } else {
      parts.push({ type: "file", file: { filename: a.name ?? "file", file_data: a.dataUrl } });
    }
  }
  return parts;
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ChatInput) => data)
  .handler(async ({ data, context }) => {
    const rawMsgs: AiMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
    if (data.context) rawMsgs.push({ role: "system", content: `سياق:\n${data.context}` });
    for (const m of data.messages) {
      rawMsgs.push({ role: m.role, content: await buildContent(m) });
    }

    // History trim: keep last 8 messages verbatim.
    const strMsgs = rawMsgs.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : "[محتوى مرفق]",
    }));
    const trim = trimHistory(strMsgs as any);
    const keepIdx = new Set(trim.trimmed.map((_, i) => i));
    const finalMsgs = rawMsgs.filter((_, i) => keepIdx.has(i));

    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const atts = lastUser?.attachments ?? [];
    const hasPdf = atts.some((a) => a.kind === "file" && a.mime === "application/pdf");
    const hasImage = atts.some((a) => a.kind === "image");
    const taskType = hasPdf || hasImage ? "admin_assistant_file" : "admin_assistant_chat";

    // First-time file upload: persist extracted text so the next chat turn skips re-uploading.
    if ((hasPdf || hasImage) && atts.length) {
      // The reply may summarize/extract the file; save it after the call finishes.
    }

    const result = await callAI(taskType as any, finalMsgs, {
      userId: context.userId,
      role: "admin",
    });

    // Best-effort: extract each attachment's textual reflection from the assistant reply
    // and remember it so follow-ups can reuse it. Only do this when we didn't already
    // have the extracted text (first time we see this file).
    for (const a of atts) {
      const hash = await hashDataUrl(a.dataUrl);
      if (!hash) continue;
      const existing = await lookupDocumentByHash(hash);
      if (existing) continue;
      // Store the assistant reply as an approximation of the file content so future
      // turns can inline it instead of re-uploading the raw file.
      await saveExtractedDocument({
        hash,
        fileName: a.name,
        mimeType: a.mime,
        text: result.text.slice(0, 60_000),
      });
    }

    return { reply: result.text, cached: result.cached, tokens: { in: result.tokensIn, out: result.tokensOut } };
  });

export const analyzeExamResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { examId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: examRow } = await supabase
      .from("exams")
      .select("id, title, subject, total_score")
      .eq("id", data.examId)
      .maybeSingle();
    const exam = examRow as any;
    if (!exam) throw new Error("الامتحان غير موجود");

    const { data: attempts } = await supabase
      .from("exam_attempts")
      .select("id, score, total, status, student_id, students(full_name)")
      .eq("exam_id", data.examId)
      .in("status", ["submitted", "graded"]);

    const rows = attempts ?? [];
    const scores = rows.map((r: any) => Number(r.score ?? 0));
    const totals = rows.map((r: any) => Number(r.total ?? exam.total_score ?? 0));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxTotal = Math.max(...totals, Number(exam.total_score ?? 0), 1);
    const pct = (avg / maxTotal) * 100;

    const { data: answers } = await supabase
      .from("attempt_answers")
      .select("question_id, is_correct, questions(text)")
      .in("attempt_id", rows.map((r: any) => r.id));

    const perQ: Record<string, { text: string; correct: number; total: number }> = {};
    for (const a of answers ?? []) {
      const qid = (a as any).question_id;
      const text = ((a as any).questions?.text ?? "").slice(0, 80);
      perQ[qid] = perQ[qid] ?? { text, correct: 0, total: 0 };
      perQ[qid].total += 1;
      if ((a as any).is_correct) perQ[qid].correct += 1;
    }
    const hardest = Object.values(perQ)
      .filter((q) => q.total >= 2)
      .sort((a, b) => a.correct / a.total - b.correct / b.total)
      .slice(0, 5)
      .map((q) => `- ${q.text} (${Math.round((q.correct / q.total) * 100)}%)`)
      .join("\n");

    // Compact summary; the model doesn't need the full history.
    const summary = `امتحان: ${exam.title}
محاولات: ${rows.length} | متوسط: ${avg.toFixed(1)}/${maxTotal} (${pct.toFixed(1)}%)
أصعب الأسئلة:
${hardest || "-"}`;

    const result = await callAI(
      "exam_analytics",
      [
        { role: "system", content: "حلّل نتائج امتحان دراسات اجتماعية بالعربية: ملخص، نقاط قوة/ضعف، توصيات، رسالة مقترحة لأولياء الأمور. اختصر." },
        { role: "user", content: summary },
      ],
      { userId: context.userId, role: "admin", cacheScope: data.examId },
    );

    return { insights: result.text, avg, pct, attempts: rows.length, cached: result.cached };
  });

export const analyzeStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: student } = await supabase
      .from("students")
      .select("id, full_name, code, points, level, classes(name), groups(name)")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("الطالب غير موجود");

    const { data: attempts } = await supabase
      .from("exam_attempts")
      .select("score, total, exams(title, subject)")
      .eq("student_id", data.studentId)
      .in("status", ["submitted", "graded"])
      .order("created_at", { ascending: false })
      .limit(20);

    const lines =
      (attempts ?? [])
        .map((a: any) => `- ${a.exams?.title ?? "امتحان"}: ${a.score}/${a.total}`)
        .join("\n") || "-";

    const summary = `${(student as any).full_name} (${(student as any).code})
صف: ${(student as any).classes?.name ?? "-"} | مجموعة: ${(student as any).groups?.name ?? "-"}
نقاط: ${(student as any).points} | مستوى: ${(student as any).level}
النتائج:
${lines}`;

    const result = await callAI(
      "student_analytics",
      [
        { role: "system", content: "قدّم تحليلاً شخصياً لطالب دراسات اجتماعية بالعربية: تقييم، نقاط قوة/ضعف، خطة تحسين، رسالة تحفيزية، رسالة لولي الأمر. اختصر." },
        { role: "user", content: summary },
      ],
      { userId: context.userId, role: "admin", cacheScope: data.studentId },
    );

    return { insights: result.text, cached: result.cached };
  });
