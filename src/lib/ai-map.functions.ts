import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
عدد النقاط المطلوب: ${data.num_points} نقطة موزّعة بذكاء على الخريطة.
- إن كانت هناك صورة خريطة مرفقة أو محدّدة، ضع النقاط على مواقعها الفعلية على الصورة.
- إن لم توجد صورة، اقترح map_image_prompt بالإنجليزية لتوليد خريطة تعليمية واضحة.
- كل نقطة يجب أن تحتوي سؤالاً واضحًا (prompt) وإجابة صحيحة قصيرة (label).
- نوّع الأسئلة: محيطات، جبال، أنهار، دول، مدن، حدود، عواصم...
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
