import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
// analyzeMapImage — vision-based analysis of an admin-uploaded map image.
// Detects geographic locations already visible on the map, places numbered
// markers at their actual pixel positions (as 0-100% coordinates), and
// generates a question + answer for each. Everything returned is fully
// editable in the interactive editor before saving.
// ============================================================================

const AnalyzeInput = z.object({
  image_data_url: z.string().min(20),
  language: z.enum(["ar", "en"]).default("ar"),
  max_points: z.number().int().min(2).max(25).default(8),
  focus: z.string().optional().default(""), // e.g. "الجبال والأنهار فقط"
  model: z.string().optional(),
});

const ANALYZE_SCHEMA = `أعد ردًا بصيغة JSON فقط وفق المخطط:
{
  "title": "عنوان مقترح للخريطة",
  "summary": "وصف مختصر لما تعرضه الخريطة (سطر واحد)",
  "points": [
    {
      "label": "اسم المكان (الإجابة الصحيحة القصيرة)",
      "prompt": "السؤال المقترح للطالب حول هذا الرقم",
      "hint": "تلميح اختياري قصير",
      "x": 50, "y": 50
    }
  ]
}
- x و y بالنسبة المئوية 0-100 (يسار→يمين، أعلى→أسفل) وتشير لمركز الرمز على الصورة.
- ضع كل نقطة فوق الموقع الجغرافي الحقيقي على الصورة بدقة.
- ممنوع تكرار نفس الموقع أو نفس الإجابة.
- المسافة بين أي نقطتين ≥ 10 وحدات.`;

export const analyzeMapImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("مسموح للأدمن فقط");

    const { callLovableChat, parseJsonLoose } = await import("./ai-gateway.server");

    const systemPrompt = `أنت خبير جغرافيا ومحلل خرائط ذكي لمنصة "الطارق التعليمية" (مادة الدراسات الاجتماعية).
مهمتك: فحص صورة الخريطة والتعرف بصريًا على المعالم (دول، عواصم، مدن، محيطات، بحار، أنهار، جبال، صحارى، حدود...)، ثم اقتراح حتى ${data.max_points} نقاط.
لغة الأسئلة: ${data.language === "ar" ? "العربية الفصحى" : "English"}.
${data.focus ? `ركّز على: ${data.focus}.` : ""}

⚠️ قواعد الإحداثيات (بالغ الأهمية — دقتها أهم من عدد النقاط):
- x = (المسافة الأفقية من الحافة اليسرى للصورة ÷ العرض الكلي للصورة) × 100.
- y = (المسافة الرأسية من الحافة العلوية للصورة ÷ الارتفاع الكلي للصورة) × 100.
- x=0 هي أقصى اليسار، x=100 أقصى اليمين. y=0 الأعلى، y=100 الأسفل. **لا تعكس المحاور**.
- ضع الإحداثية على **مركز المعلم الفعلي داخل الصورة**، وليس على النص/الاسم المكتوب بجواره.
- إذا كنت غير متأكد من الموقع الدقيق لمعلم معيّن، **احذفه ولا تخمّن**. جودة أفضل من كمية.
- تحقّق ذهنيًا من كل نقطة قبل إخراجها: هل لو رسمت دائرة عندها ستقع بالفعل فوق المعلم؟

📝 قواعد الأسئلة:
- السؤال يجب أن يكون قابلاً للإجابة **دون قراءة أي نص مكتوب على الخريطة**، لأن أسماء الأماكن ستُخفى قبل عرضها للطالب.
- الإجابة قصيرة (كلمة أو كلمتين).
- ممنوع تكرار الإجابة أو الموقع، والمسافة بين أي نقطتين ≥ 10 وحدات.
${ANALYZE_SCHEMA}`;

    const content = await callLovableChat(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "حلّل هذه الخريطة وأنشئ النقاط والأسئلة." },
            { type: "image_url", image_url: { url: data.image_data_url } },
          ],
        },
      ],
      {
        // Pro model does far better vision-grounded coordinate work
        models: data.model
          ? [data.model, "google/gemini-3.1-pro-preview", "google/gemini-2.5-pro"]
          : ["google/gemini-3.1-pro-preview", "google/gemini-2.5-pro", "google/gemini-3.5-flash"],
        responseJson: true,
        temperature: 0.3,
      },
    );

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ai_usage_logs").insert({ function_name: "analyze_map_image", success: true });
    } catch {}

    let parsed: any;
    try {
      parsed = parseJsonLoose(content);
    } catch {
      throw new Error("تعذّر تحليل رد الذكاء الاصطناعي. حاول مرة أخرى.");
    }

    const rawPoints = Array.isArray(parsed?.points) ? parsed.points : [];
    if (!rawPoints.length) throw new Error("لم يستطع الذكاء الاصطناعي تحديد أي مواقع على هذه الصورة.");

    const normalized = rawPoints.map((p: any) => ({
      label: String(p?.label ?? "").trim() || "موقع",
      prompt: typeof p?.prompt === "string" ? p.prompt.trim() : "",
      hint: typeof p?.hint === "string" ? p.hint.trim() : "",
      x: Math.max(3, Math.min(97, Math.round(Number(p?.x ?? 50) * 10) / 10)),
      y: Math.max(3, Math.min(97, Math.round(Number(p?.y ?? 50) * 10) / 10)),
    }));

    // Deduplicate: same label OR too close (< 8% of the image)
    const points: typeof normalized = [];
    const seen = new Set<string>();
    for (const p of normalized) {
      const key = p.label.toLowerCase();
      if (seen.has(key)) continue;
      if (points.some((q: { x: number; y: number }) => Math.hypot(q.x - p.x, q.y - p.y) < 8)) continue;
      seen.add(key);
      points.push(p);
      if (points.length >= data.max_points) break;
    }
    if (!points.length) throw new Error("لم يتم إنشاء نقاط صالحة على الخريطة.");

    return {
      title: String(parsed?.title ?? "خريطة").trim() || "خريطة",
      summary: String(parsed?.summary ?? "").trim(),
      points,
    };
  });

// ============================================================================
// generateInteractiveMap — original: generate points (and optionally an image)
// from a topic/attachments. Kept as-is for the exam-editor "AI generate" flow.
// ============================================================================


const GenInput = z.object({
  topic: z.string().default(""),
  language: z.enum(["ar", "en"]).default("ar"),
  num_points: z.number().int().min(1).max(20).default(6),
  points_per_question: z.number().min(0.5).max(20).default(1),
  attachments: z.array(z.object({
    kind: z.enum(["image", "pdf"]),
    name: z.string(),
    data_url: z.string(),
  })).default([]),
  // Optional pre-uploaded map image (data URL). When missing, AI will generate one.
  map_image_data_url: z.string().nullable().optional(),
  map_image_prompt: z.string().optional(),
  model: z.string().optional(),
});

const SCHEMA_HINT = `أعد ردًا بصيغة JSON فقط وفق المخطط:
{
  "title": "عنوان مقترح للسؤال (مثال: تضاريس أستراليا)",
  "map_image_prompt": "وصف مختصر بالإنجليزية لصورة الخريطة (اختياري إن لم توجد صورة)",
  "points": [
    { "prompt": "سؤال هذا الرقم (مثال: ما اسم هذا المحيط؟)", "label": "الإجابة الصحيحة", "x": 50, "y": 50 }
  ]
}
x و y إحداثيات نسبية من 0 إلى 100 (يسار→يمين، أعلى→أسفل).`;

export const generateInteractiveMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GenInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("مسموح للأدمن فقط");

    const { callLovableChat, parseJsonLoose, generateImageViaGateway } = await import("./ai-gateway.server");

    const systemPrompt = `أنت مساعد ذكاء اصطناعي متخصص في إعداد أسئلة خرائط تفاعلية لمادة الدراسات الاجتماعية (تاريخ، جغرافيا، مواطنة) لمنصة "الطارق التعليمية".
لغة الأسئلة: ${data.language === "ar" ? "العربية الفصحى" : "English"}.
عدد النقاط المطلوب بالضبط: ${data.num_points} نقطة (لا أكثر ولا أقل) موزّعة على مواقع مختلفة تمامًا.
قواعد صارمة:
- ممنوع تمامًا تكرار نفس الموقع أو نفس الإجابة.
- المسافة بين أي نقطتين يجب ألا تقل عن 10 وحدات (على مقياس 0-100) في x أو y.
- إن كانت هناك صورة خريطة مرفقة، ضع النقاط على مواقعها الفعلية على الصورة بدقة عالية.
- إن لم توجد صورة، اقترح map_image_prompt بالإنجليزية لتوليد خريطة تعليمية واضحة.
- كل نقطة سؤال واضح مختلف (prompt) وإجابة صحيحة قصيرة مميّزة (label).
- نوّع الأسئلة والمواقع: محيطات، جبال، أنهار، دول، مدن، حدود، عواصم...
${SCHEMA_HINT}`;

    const parts: Array<Record<string, unknown>> = [];
    const textInstruction = [
      data.topic ? `الموضوع/الدرس: ${data.topic}` : "",
      data.attachments.length ? `استخرج المفاهيم الجغرافية من المرفقات التالية:\n${data.attachments.map((a, i) => `- ${i + 1}. ${a.name} (${a.kind})`).join("\n")}` : "",
      data.map_image_data_url ? "استخدم صورة الخريطة المرفقة الأخيرة كمرجع لتحديد المواقع." : "",
      "أنشئ الآن سؤال الخريطة التفاعلي بصيغة JSON فقط.",
    ].filter(Boolean).join("\n\n");
    parts.push({ type: "text", text: textInstruction });
    for (const att of data.attachments) {
      if (att.kind === "image") parts.push({ type: "image_url", image_url: { url: att.data_url } });
      else parts.push({ type: "file", file: { filename: att.name, file_data: att.data_url } });
    }
    if (data.map_image_data_url) {
      parts.push({ type: "image_url", image_url: { url: data.map_image_data_url } });
    }

    const content = await callLovableChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: parts },
    ], {
      models: data.model ? [data.model, "google/gemini-2.5-pro", "google/gemini-3.5-flash"] : ["google/gemini-2.5-pro", "google/gemini-3.5-flash"],
      responseJson: true,
      temperature: 0.5,
    });

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ai_usage_logs").insert({ function_name: "generate_interactive_map", success: true });
    } catch {}

    let parsed: any;
    try { parsed = parseJsonLoose(content); } catch {
      throw new Error("تعذّر تحليل رد الذكاء الاصطناعي. حاول مرة أخرى.");
    }

    const rawPoints = Array.isArray(parsed?.points) ? parsed.points : [];
    if (!rawPoints.length) throw new Error("لم يتم توليد أي نقاط على الخريطة.");

    // Normalize, clamp, and deduplicate: models often repeat the same location
    // or place multiple markers within a few pixels of each other. Enforce a
    // minimum distance (~8% of the image) and unique prompt/label keys.
    const normalized = rawPoints.map((p: any) => ({
      label: String(p?.label ?? "").trim() || "الإجابة الصحيحة",
      prompt: typeof p?.prompt === "string" ? p.prompt.trim() : "",
      x: Math.max(4, Math.min(96, Math.round(Number(p?.x ?? 50)))),
      y: Math.max(4, Math.min(96, Math.round(Number(p?.y ?? 50)))),
    }));
    const points: typeof normalized = [];
    const seenKeys = new Set<string>();
    for (const p of normalized) {
      const key = `${p.prompt}|${p.label}`.toLowerCase();
      if (seenKeys.has(key)) continue;
      const tooClose = points.some((q: { x: number; y: number }) => Math.hypot(q.x - p.x, q.y - p.y) < 8);
      if (tooClose) continue;
      seenKeys.add(key);
      points.push(p);
      if (points.length >= data.num_points) break;
    }
    if (!points.length) throw new Error("تعذّر إنشاء نقاط صالحة على الخريطة.");

    let imageUrl = data.map_image_data_url ?? null;
    if (!imageUrl) {
      const prompt = data.map_image_prompt?.trim()
        || (typeof parsed?.map_image_prompt === "string" && parsed.map_image_prompt.trim())
        || `Clear educational blank map illustration related to: ${data.topic || "geography"}. Flat vector style, high contrast, labeled borders, suitable as a quiz map, no answers shown.`;
      try { imageUrl = await generateImageViaGateway(prompt); } catch { imageUrl = null; }
    }

    return {
      title: String(parsed?.title ?? data.topic ?? "سؤال خريطة"),
      image_url: imageUrl,
      points,
      points_per_question: data.points_per_question,
    };
  });

// ============================================================================
// cleanMapImage — remove all text labels / place names from the map image
// using Nano Banana image editing. Returns a data URL of the cleaned map so
// students see a bare map without the answers written on it.
// ============================================================================
const CleanInput = z.object({
  image_data_url: z.string().min(20),
  extra_instruction: z.string().optional().default(""),
});

export const cleanMapImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CleanInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("مسموح للأدمن فقط");

    const { editImageViaGateway } = await import("./ai-gateway.server");

    const instruction = `Edit this map image: REMOVE every text label, place name, country name, city name, ocean name, river name, mountain name, legend text, compass rose text, scale bar text, and any written words or numbers that appear on the map — in every language (Arabic, English, or otherwise). Keep the geography, coastlines, borders, colors, terrain shading, rivers, and visual features exactly the same. Do NOT add new labels. Do NOT crop, rotate, or reframe the image — keep identical dimensions and composition so coordinates remain valid. Output only the cleaned map image.${data.extra_instruction ? ` Additional: ${data.extra_instruction}` : ""}`;

    // Try Nano Banana first, fall back to the newer variant if available.
    const models = [
      "google/gemini-2.5-flash-image-preview",
      "google/gemini-3.1-flash-image",
      "google/gemini-3-pro-image",
    ];
    let cleaned: string | null = null;
    for (const m of models) {
      cleaned = await editImageViaGateway(instruction, data.image_data_url, { model: m });
      if (cleaned) break;
    }
    if (!cleaned) throw new Error("تعذّر تنظيف الخريطة الآن. حاول مرة أخرى.");

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ai_usage_logs").insert({ function_name: "clean_map_image", success: true });
    } catch {}

    return { image_data_url: cleaned };
  });
