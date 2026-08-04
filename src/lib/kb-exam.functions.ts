import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  instruction: z.string().min(3),
  classId: z.string().uuid().nullable().default(null),
  documentId: z.string().uuid().nullable().default(null),
  useKnowledge: z.boolean().default(true),
  useBank: z.boolean().default(false),
  num_questions: z.number().int().min(1).max(50).default(10),
  question_types: z.array(z.string()).min(1).default(["mcq"]),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  points_per_question: z.number().min(0.5).max(20).default(1),
  total_score: z.number().min(1).max(1000).nullable().default(null),
});

/** Generate an exam grounded in the teacher's knowledge base and/or question bank. */
export const generateExamFromKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("مسموح للأدمن فقط");

    const { collectExamContext, EXAM_SCHEMA_HINT, normalizeGenerated } = await import("@/lib/ai/exam-from-kb.server");
    const { callLovableChat, parseJsonLoose } = await import("@/lib/ai-gateway.server");

    const ctx = data.useKnowledge
      ? await collectExamContext({
          instruction: data.instruction,
          classId: data.classId,
          documentId: data.documentId,
          useBank: data.useBank,
        })
      : await collectExamContext({ instruction: data.instruction, classId: data.classId, useBank: data.useBank, documentId: null });

    if (!ctx.context && ctx.bankQuestions.length === 0) {
      throw new Error("لم أجد محتوى مطابق في قاعدة المعرفة أو بنك الأسئلة — راجع الصف أو صياغة الطلب.");
    }

    const pointsInstruction =
      data.total_score && data.total_score > 0
        ? `الدرجة الكلية = ${data.total_score}؛ وزّع الدرجات بحيث يكون المجموع مطابقًا تمامًا.`
        : `درجة كل سؤال: ${data.points_per_question}.`;

    const bankBlock = ctx.bankQuestions.length
      ? `\n\nأسئلة جاهزة من بنك الأسئلة — يمكنك اختيار المناسب منها أو إعادة صياغته:\n${ctx.bankQuestions
          .slice(0, 25)
          .map((b: any, i: number) => `(${i + 1}) ${b.title} — ${JSON.stringify(b.content).slice(0, 600)}`)
          .join("\n")}`
      : "";

    const systemPrompt = `أنت معلّم دراسات اجتماعية تُعدّ امتحانات لمنصة "الطارق التعليمية".
اعتمد حصريًا على المحتوى المرفق من منهج المدرس ولا تخترع معلومات من خارجه.
عدد الأسئلة: ${data.num_questions}. الأنواع المسموحة: ${data.question_types.join(", ")}. الصعوبة: ${data.difficulty}.
${pointsInstruction}
${EXAM_SCHEMA_HINT}`;

    const userPrompt = `طلب المدرس: ${data.instruction}

محتوى المنهج:
${ctx.context || "(لا يوجد)"}${bankBlock}

أنشئ الامتحان الآن بصيغة JSON فقط.`;

    const content = await callLovableChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { responseJson: true, temperature: 0.4 },
    );

    let parsed: any;
    try {
      parsed = parseJsonLoose(content);
    } catch {
      throw new Error("تعذّر تحليل رد الذكاء الاصطناعي. حاول مرة أخرى.");
    }
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    if (!questions.length) throw new Error("لم يتم توليد أي أسئلة.");

    return {
      title: parsed.title ?? data.instruction.slice(0, 80),
      questions: normalizeGenerated(questions, data.question_types, data.points_per_question, data.total_score ?? null),
      sources: ctx.sources,
      usedChunks: ctx.chunkCount,
      usedBank: ctx.bankQuestions.length,
    };
  });
