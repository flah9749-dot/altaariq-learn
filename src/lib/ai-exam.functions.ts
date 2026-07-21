import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GenInput = z.object({
  topic: z.string().default(""),
  raw_text: z.string().default(""),
  attachments: z.array(z.object({
    kind: z.enum(["image", "pdf"]),
    name: z.string(),
    data_url: z.string(), // data:...;base64,...
  })).default([]),
  num_questions: z.number().int().min(1).max(50).default(10),
  question_types: z.array(z.string()).min(1).default(["mcq"]),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  language: z.enum(["ar", "en"]).default("ar"),
  points_per_question: z.number().min(0.5).max(20).default(1),
  total_score: z.number().min(1).max(1000).nullable().optional(),
  model: z.string().optional(),
});

const SCHEMA_HINT = `أعد ردًا بصيغة JSON فقط بالمخطط التالي، بدون أي شرح خارج JSON:
{
  "title": "عنوان مقترح للامتحان",
  "questions": [
    {
      "type": "mcq | true_false | complete | essay | order | match",
      "text": "نص السؤال",
      "difficulty": "easy | medium | hard",
      "points": 1,
      "explanation": "شرح الإجابة (اختياري)",
      "options": [{"text": "...", "is_correct": true}],  // للاختيار من متعدد فقط
      "correct_answer": ...  // للأنواع الأخرى: true/false، نص للإكمال، مصفوفة للترتيب، كائن key->value للتوصيل
    }
  ]
}`;

export const generateExamWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GenInput.parse(data))
  .handler(async ({ data, context }) => {
    // Admin only
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("مسموح للأدمن فقط");

    const { callLovableChat, parseJsonLoose, DEFAULT_MODEL_CHAIN } = await import("./ai-gateway.server");

    const pointsInstruction = data.total_score && data.total_score > 0
      ? `الدرجة الكلية للامتحان: ${data.total_score}. وزّع الدرجات على الأسئلة بحيث يكون مجموعها = ${data.total_score} بالضبط، مع مراعاة صعوبة كل سؤال (السهل درجة أقل، الصعب درجة أعلى). استخدم أرقامًا بنصف درجة عند الحاجة.`
      : `درجة كل سؤال: ${data.points_per_question}.`;

    const systemPrompt = `أنت مساعد ذكاء اصطناعي تعليمي متخصص في إعداد امتحانات لمادة الدراسات الاجتماعية (تاريخ، جغرافيا، مواطنة) لمنصة "الطارق التعليمية".
لغة الأسئلة: ${data.language === "ar" ? "العربية الفصحى" : "English"}.
عدد الأسئلة المطلوب: ${data.num_questions}.
الأنواع المسموح بها: ${data.question_types.join(", ")}.
مستوى الصعوبة: ${data.difficulty}.
${pointsInstruction}
تأكد من دقة الإجابات الصحيحة وتنوع الأسئلة.
${SCHEMA_HINT}`;

    // Build user content with multimodal parts
    const parts: Array<Record<string, unknown>> = [];
    const textInstruction = [
      data.topic ? `الموضوع: ${data.topic}` : "",
      data.raw_text ? `المحتوى المرجعي:\n${data.raw_text.slice(0, 12000)}` : "",
      data.attachments.length ? "استخرج النص من المرفقات (صور/PDF) إن وُجدت واستخدمه لإنشاء الأسئلة." : "",
      "أنشئ الآن الامتحان بصيغة JSON فقط.",
    ].filter(Boolean).join("\n\n");
    parts.push({ type: "text", text: textInstruction });
    for (const att of data.attachments) {
      if (att.kind === "image") {
        parts.push({ type: "image_url", image_url: { url: att.data_url } });
      } else {
        parts.push({ type: "file", file: { filename: att.name, file_data: att.data_url } });
      }
    }

    const content = await callLovableChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: parts },
    ], {
      models: data.model ? [data.model, ...DEFAULT_MODEL_CHAIN] : undefined,
      responseJson: true,
      temperature: 0.4,
    });

    // Log usage
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ai_usage_logs").insert({
        function_name: "generate_exam", success: true,
      });
    } catch {}

    let parsed: any;
    try { parsed = parseJsonLoose(content); } catch (e: any) {
      throw new Error("تعذّر تحليل رد الذكاء الاصطناعي. حاول مرة أخرى أو أعد صياغة المدخلات.");
    }
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    if (!questions.length) throw new Error("لم يتم توليد أي أسئلة. حاول تعديل المدخلات.");

    // Normalize
    const normalized = questions.map((q: any, i: number) => ({
      type: q.type ?? "mcq",
      text: q.text ?? "",
      points: Number(q.points ?? data.points_per_question) || data.points_per_question,
      explanation: q.explanation ?? null,
      difficulty: q.difficulty ?? null,
      order_index: i,
      correct_answer: q.correct_answer ?? null,
      options: Array.isArray(q.options) ? q.options.map((o: any, oi: number) => ({
        text: String(o.text ?? ""),
        is_correct: !!o.is_correct,
        order_index: oi,
      })) : [],
    }));

    return {
      title: parsed.title ?? data.topic ?? "امتحان جديد",
      questions: normalized,
    };
  });
