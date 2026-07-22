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
      "type": "mcq | true_false | complete | essay | order | match | map",
      "text": "نص السؤال",
      "difficulty": "easy | medium | hard",
      "points": 1,
      "explanation": "شرح الإجابة (اختياري)",
      "options": [{"text": "...", "is_correct": true}],  // للاختيار من متعدد فقط
      "image_url": "attachment:اسم_الصورة" , // لأسئلة الخرائط فقط عند استخدام صورة مرفقة
      "map_image_prompt": "وصف مختصر بالإنجليزية لصورة الخريطة المطلوبة (اختياري، لأسئلة الخرائط فقط عندما لا توجد صورة مرفقة). مثل: 'Blank political map of Australia highlighting Tasmania location, educational style, labeled regions'",
      "correct_answer": ...  // للأنواع الأخرى: true/false، نص للإكمال، مصفوفة للترتيب، كائن key->value للتوصيل، وللخريطة: {"points":[{"prompt":"سؤال هذا الرقم مثل: ما اسم هذا المحيط؟","label":"الإجابة الصحيحة","x":50,"y":50}, ...]} — كل نقطة على الخريطة تمثل سؤالاً مستقلاً، يرى الطالب الأرقام على الخريطة وسؤال كل رقم ويكتب الإجابة.
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

    const { callLovableChat, parseJsonLoose, DEFAULT_MODEL_CHAIN, generateImageViaGateway, editImageViaGateway } = await import("./ai-gateway.server");

    const CLEAN_MAP_INSTRUCTION = `Edit this map image: REMOVE every text label, place name, country name, city name, ocean name, river name, mountain name, legend text, numbered list, compass rose text, scale bar text, and any written words or numbers that appear on the map — in every language (Arabic, English, or otherwise). Keep the geography, coastlines, borders, colors, terrain shading, rivers, and visual features exactly the same. Do NOT add new labels. Do NOT crop, rotate, or reframe the image — keep identical dimensions and composition so coordinates remain valid. Output only the cleaned map image.`;
    const cleanMapModels = ["google/gemini-2.5-flash-image-preview", "google/gemini-3.1-flash-image", "google/gemini-3-pro-image"];
    async function cleanMapLabels(url: string): Promise<string> {
      for (const m of cleanMapModels) {
        try {
          const out = await editImageViaGateway(CLEAN_MAP_INSTRUCTION, url, { model: m });
          if (out) return out;
        } catch {}
      }
      return url;
    }

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
      data.attachments.length ? `استخرج النص من المرفقات (صور/PDF) إن وُجدت واستخدمه لإنشاء الأسئلة.\nالمرفقات المتاحة:\n${data.attachments.map((a, index) => `- ${index + 1}. ${a.name} (${a.kind})`).join("\n")}` : "",
      data.question_types.includes("map") ? `تعليمات أسئلة الخرائط:
- إذا كان الموضوع مناسبًا للخرائط (جغرافيا، دول، قارات، مواقع، حدود، تضاريس...)، أنشئ سؤالاً أو أكثر من النوع "map".
- إذا وُجدت صورة خريطة ضمن المرفقات، استخدمها وضع image_url = "attachment:اسم_الصورة".
- إذا لم توجد صورة مرفقة، اترك image_url فارغًا وأضف حقل map_image_prompt بوصف مختصر بالإنجليزية لصورة الخريطة المطلوب توليدها تلقائيًا (يجب أن يصف خريطة تعليمية واضحة تُظهر المنطقة الجغرافية المطلوبة).
- استخدم إحداثيات نسبية على الخريطة من 0 إلى 100: x من يسار الصورة إلى يمينها، y من أعلى الصورة إلى أسفلها.
- correct_answer يجب أن يكون: {"points":[{"prompt":"سؤال هذا الرقم (مثال: ما اسم هذا المحيط؟ ما هذه السلسلة الجبلية؟)","label":"الإجابة الصحيحة","x":50,"y":50}, ...]} — يمكنك وضع عدة نقاط مرقّمة على نفس الخريطة، كل نقطة سؤال مستقل بدرجته. اجعل الأسئلة متنوعة: محيطات، جبال، أنهار، دول، مدن، حدود...` : "",
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
    const imageAttachments = data.attachments.filter((att) => att.kind === "image");
    const resolveImageUrl = (value: unknown) => {
      if (typeof value === "string" && value.startsWith("data:")) return value;
      if (typeof value === "string" && value.startsWith("attachment:")) {
        const name = value.replace(/^attachment:/, "").trim();
        return imageAttachments.find((att) => att.name === name)?.data_url ?? imageAttachments[0]?.data_url ?? null;
      }
      return typeof value === "string" && value.trim() ? value : null;
    };

    const normalizeMapAnswer = (answer: any) => {
      const points = Array.isArray(answer?.points) ? answer.points : Array.isArray(answer) ? answer : [];
      const clean = points
        .map((p: any) => ({
          label: String(p?.label ?? "الإجابة الصحيحة"),
          prompt: typeof p?.prompt === "string" ? p.prompt : (typeof p?.question === "string" ? p.question : ""),
          x: Math.max(0, Math.min(100, Number(p?.x ?? 50))),
          y: Math.max(0, Math.min(100, Number(p?.y ?? 50))),
        }))
        .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
      return { points: clean.length ? clean : [{ label: "الإجابة الصحيحة", prompt: "", x: 50, y: 50 }] };
    };

    const normalized = await Promise.all(questions.map(async (q: any, i: number) => {
      const type = data.question_types.includes(q.type) ? q.type : "mcq";
      let imageUrl = resolveImageUrl(q.image_url) ?? (type === "map" ? imageAttachments[0]?.data_url ?? null : null);
      // Auto-generate a map image when the question is a map question and no image is available
      if (type === "map" && !imageUrl) {
        const prompt = typeof q.map_image_prompt === "string" && q.map_image_prompt.trim()
          ? q.map_image_prompt.trim()
          : `Clear educational blank map illustration related to: ${String(q.text ?? data.topic ?? "geography")}. Flat vector style, high contrast, labeled borders, suitable as a quiz map, no text answers shown.`;
        try {
          imageUrl = await generateImageViaGateway(prompt);
        } catch { imageUrl = null; }
      }
      return {
        type,
        text: q.text ?? "",
        image_url: imageUrl,
        points: Number(q.points ?? data.points_per_question) || data.points_per_question,
        explanation: q.explanation ?? null,
        difficulty: q.difficulty ?? null,
        order_index: i,
        correct_answer: type === "map" ? normalizeMapAnswer(q.correct_answer) : q.correct_answer ?? null,
        options: Array.isArray(q.options) ? q.options.map((o: any, oi: number) => ({
          text: String(o.text ?? ""),
          is_correct: !!o.is_correct,
          order_index: oi,
        })) : [],
      };
    }));

    // Enforce total_score exactly if provided (scale then round to 0.5, fix drift on last question)
    if (data.total_score && data.total_score > 0 && normalized.length > 0) {
      const currentSum = normalized.reduce((a: number, q: any) => a + (Number(q.points) || 0), 0) || normalized.length;
      const factor = data.total_score / currentSum;
      let running = 0;
      normalized.forEach((q: any, idx: number) => {
        if (idx === normalized.length - 1) {
          q.points = Math.max(0.5, Math.round((data.total_score! - running) * 2) / 2);
        } else {
          const p = Math.max(0.5, Math.round(q.points * factor * 2) / 2);
          q.points = p;
          running += p;
        }
      });
    }

    return {
      title: parsed.title ?? data.topic ?? "امتحان جديد",
      questions: normalized,
    };
  });
