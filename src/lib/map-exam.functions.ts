// ============================================================================
// Map Exam orchestration — standalone "AI Map Exam" builder.
// Steps: clean uploaded map → analyze cleaned map → return editable points
// with a default sub-question per marker.
// Saves as regular exam rows with type='map' (existing take/grade flow works).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { makeMapSubQuestion, type MapSubQuestion } from "./exam-utils";

const BuildInput = z.object({
  image_data_url: z.string().min(20),
  language: z.enum(["ar", "en"]).default("ar"),
  max_points: z.number().int().min(2).max(25).default(8),
  focus: z.string().optional().default(""),
  skip_clean: z.boolean().optional().default(false),
  // Optional labeled grid overlay built client-side. When provided, the AI is
  // asked to answer with grid cells (e.g. "H14") which we convert to x/y — this
  // is dramatically more accurate than free-form pixel guessing.
  grid_image_data_url: z.string().optional(),
  grid_cols: z.number().int().min(4).max(40).optional(),
  grid_rows: z.number().int().min(4).max(40).optional(),
});

export type MapExamPoint = {
  label: string;
  prompt: string;
  hint: string;
  x: number;
  y: number;
  questions: MapSubQuestion[];
};

export const autoBuildMapPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BuildInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("مسموح للأدمن فقط");

    const { editImageViaGateway, callLovableChat, parseJsonLoose } =
      await import("./ai-gateway.server");

    // 1) Clean labels off the map so students don't see the answers.
    let cleaned = data.image_data_url;
    if (!data.skip_clean) {
      const instruction = `Edit this map image: REMOVE every text label, place name, country name, city name, ocean name, river name, mountain name, legend text, numbered list, compass rose text, scale bar text, and any written words or numbers that appear on the map — in every language (Arabic, English, or otherwise). Keep the geography, coastlines, borders, colors, terrain shading, rivers, and visual features exactly the same. Do NOT add new labels. Do NOT crop, rotate, or reframe the image — keep identical dimensions and composition so coordinates remain valid. Output only the cleaned map image.`;
      const models = [
        "google/gemini-2.5-flash-image-preview",
        "google/gemini-3.1-flash-image",
        "google/gemini-3-pro-image",
      ];
      for (const m of models) {
        try {
          const out = await editImageViaGateway(instruction, data.image_data_url, { model: m });
          if (out) { cleaned = out; break; }
        } catch {}
      }
    }

    // 2) Analyze the ORIGINAL map (has labels → better identification), then
    //    place numbered markers on those coordinates on the cleaned image.
    const useGrid = !!(data.grid_image_data_url && data.grid_cols && data.grid_rows);
    const cols = data.grid_cols ?? 0;
    const rows = data.grid_rows ?? 0;

    const systemPrompt = `أنت خبير جغرافيا ومحلل خرائط لمنصة "الطارق التعليمية".
افحص صورة الخريطة الأصلية (بها أسماء ظاهرة) واقترح حتى ${data.max_points} نقطة على معالم بارزة.
${data.focus ? `ركّز على: ${data.focus}.` : ""}
لغة الأسئلة: ${data.language === "ar" ? "العربية الفصحى" : "English"}.

${useGrid ? `⚠️ الصورة الثانية عليها شبكة مرجعية ${cols}×${rows}: الأعمدة A..${String.fromCharCode(64 + Math.min(cols, 26))} (يسار→يمين)، الصفوف 1..${rows} (أعلى→أسفل). كل خانة مكتوب فوقها اسمها (مثل "H14") بلون أحمر.
- لكل نقطة أعِد الحقل "cell" باسم الخانة التي يقع مركز المعلم داخلها بالضبط.
- **اقرأ اسم الخانة من الشبكة نفسها**، لا تحسبها ذهنيًا.
- إذا كنت غير متأكد من الخانة الصحيحة احذف النقطة.
` : `قواعد الإحداثيات (حرجة):
- x = المسافة الأفقية من الحافة اليسرى ÷ العرض × 100.
- y = المسافة الرأسية من الحافة العلوية ÷ الارتفاع × 100.
- ضع الإحداثية على مركز المعلم، لا على النص المكتوب بجانبه.
- إذا لم تكن متأكدًا احذف النقطة.
`}
- المسافة بين أي نقطتين ≥ 8 وحدات.
- الأسئلة يجب أن تكون قابلة للإجابة بدون قراءة أي نص على الخريطة (لأن الأسماء ستُخفى).

أعد JSON فقط:
{
  "title": "عنوان مقترح",
  "summary": "وصف مختصر",
  "points": [
    { "label": "الإجابة القصيرة", "prompt": "السؤال؟", "hint": "تلميح اختياري"${useGrid ? `, "cell": "H14"` : `, "x": 50, "y": 50`} }
  ]
}`;

    const userParts: Array<Record<string, unknown>> = [
      { type: "text", text: useGrid
          ? "الصورة الأولى: الخريطة الأصلية للتعرّف على المعالم. الصورة الثانية: نفس الخريطة عليها شبكة مرجعية — استخدمها لتحديد الخانة (cell) الصحيحة لكل معلم."
          : "حلّل الخريطة وأنشئ نقاطًا وأسئلة عليها." },
      { type: "image_url", image_url: { url: data.image_data_url } },
    ];
    if (useGrid) {
      userParts.push({ type: "image_url", image_url: { url: data.grid_image_data_url } });
    }

    const content = await callLovableChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userParts },
      ],
      {
        models: ["google/gemini-3.1-pro-preview", "google/gemini-2.5-pro", "google/gemini-3.5-flash"],
        responseJson: true,
        temperature: 0.2,
      },
    );

    let parsed: any;
    try { parsed = parseJsonLoose(content); } catch {
      throw new Error("تعذّر تحليل رد الذكاء الاصطناعي. حاول مرة أخرى.");
    }
    const raw = Array.isArray(parsed?.points) ? parsed.points : [];
    if (!raw.length) throw new Error("لم يتم اكتشاف مواقع صالحة على الخريطة.");

    const { cellToPercent } = await import("./map-grid");
    const normalized = raw.map((p: any) => {
      let x = Number(p?.x ?? 50);
      let y = Number(p?.y ?? 50);
      if (useGrid && typeof p?.cell === "string") {
        const conv = cellToPercent(p.cell, cols, rows);
        if (conv) { x = conv.x; y = conv.y; }
      }
      return {
        label: String(p?.label ?? "").trim() || "موقع",
        prompt: typeof p?.prompt === "string" ? p.prompt.trim() : "",
        hint: typeof p?.hint === "string" ? p.hint.trim() : "",
        x: Math.max(3, Math.min(97, Math.round(x * 10) / 10)),
        y: Math.max(3, Math.min(97, Math.round(y * 10) / 10)),
      };
    });

    const points: MapExamPoint[] = [];
    const seen = new Set<string>();
    for (const p of normalized) {
      const key = p.label.toLowerCase();
      if (seen.has(key)) continue;
      if (points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 8)) continue;
      seen.add(key);
      // Default: one short sub-question per marker so grading is automatic.
      const sq = makeMapSubQuestion("short");
      sq.text = p.prompt || `اكتب اسم الموضع رقم ${points.length + 1}`;
      sq.answer = p.label;
      sq.points = 1;
      points.push({ ...p, questions: [sq] });
      if (points.length >= data.max_points) break;
    }
    if (!points.length) throw new Error("لم يتم توليد نقاط صالحة.");

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ai_usage_logs").insert({ function_name: "auto_build_map_page", success: true });
    } catch {}

    return {
      title: String(parsed?.title ?? "خريطة").trim() || "خريطة",
      summary: String(parsed?.summary ?? "").trim(),
      image_url_clean: cleaned,
      points,
    };
  });

// ---------------------------------------------------------------------------
// createMapExam — creates an exam and persists each page as a question row
// (type='map') so the existing student runner and auto-grader work as-is.
// ---------------------------------------------------------------------------
const PagePoint = z.object({
  label: z.string(),
  prompt: z.string().default(""),
  hint: z.string().default(""),
  x: z.number(),
  y: z.number(),
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(["short", "mcq", "true_false", "complete", "essay"]),
    text: z.string(),
    answer: z.string().optional(),
    options: z.array(z.object({ text: z.string(), is_correct: z.boolean() })).optional(),
    points: z.number().min(0).default(1),
  })).default([]),
});

const CreateInput = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().optional().default(""),
  class_id: z.string().uuid().nullable().optional(),
  group_ids: z.array(z.string().uuid()).default([]),
  duration_minutes: z.number().int().min(1).max(600).default(30),
  publish: z.boolean().default(false),
  pages: z.array(z.object({
    title: z.string().default("خريطة"),
    image_url: z.string(),
    points: z.array(PagePoint).min(1),
  })).min(1),
});

export const createMapExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("مسموح للأدمن فقط");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Compute total score from every sub-question across every page.
    let total = 0;
    for (const pg of data.pages) for (const pt of pg.points) {
      const per = pt.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
      total += per > 0 ? per : 1; // fallback: single-label grading (1 pt)
    }

    // Create exam
    const { data: exam, error: eErr } = await supabaseAdmin
      .from("exams")
      .insert({
        title: data.title,
        description: data.description || null,
        subject: "دراسات اجتماعية",
        class_id: data.class_id ?? null,
        group_ids: data.group_ids ?? [],
        duration_minutes: data.duration_minutes,
        total_score: total,
        published: !!data.publish,
        status: data.publish ? "published" : "draft",
        exam_kind: "map",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (eErr || !exam) throw new Error(eErr?.message ?? "فشل إنشاء الامتحان");

    // Insert one question row per page (type='map')
    const rows = data.pages.map((pg, i) => {
      const perPage = pg.points.reduce((s, pt) => {
        const per = pt.questions.reduce((a, q) => a + (Number(q.points) || 0), 0);
        return s + (per > 0 ? per : 1);
      }, 0);
      return {
        exam_id: exam.id,
        type: "map",
        text: pg.title || `الخريطة ${i + 1}`,
        image_url: pg.image_url,
        points: perPage,
        order_index: i,
        correct_answer: { points: pg.points },
      };
    });
    const { error: qErr } = await supabaseAdmin.from("questions").insert(rows);
    if (qErr) throw new Error(qErr.message);

    if (data.publish) {
      try {
        const { notifyStudents } = await import("./notify-helpers.server");
        await notifyStudents({
          title: "🗺️ امتحان خرائط جديد",
          body: `تم نشر امتحان: ${data.title}`,
          type: "exam",
          link: `/student/exams/${exam.id}`,
          target: { kind: "classes_groups", class_id: data.class_id ?? null, group_ids: data.group_ids ?? [] },
        });
      } catch {}
    }

    return { id: exam.id };
  });
