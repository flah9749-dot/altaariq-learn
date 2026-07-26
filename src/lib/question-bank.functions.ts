import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { notifyStudents } from "@/lib/notify-helpers.server";

type BankTargets = { id?: string; title: string; class_ids?: string[] | null; group_ids?: string[] | null };
async function notifyBankPublish(items: BankTargets[]) {
  try {
    for (const it of items) {
      const classIds = it.class_ids ?? [];
      const groupIds = it.group_ids ?? [];
      const body = `تمت إضافة "${it.title}" إلى بنك الأسئلة`;
      const link = "/student/question-bank";
      const dedupe_key = it.id ? `bank_publish:${it.id}` : null;
      if (groupIds.length) {
        await notifyStudents({ title: "📚 عنصر جديد في بنك الأسئلة", body, type: "question_bank", link, dedupe_key,
          target: { kind: "classes_groups", class_id: classIds[0] ?? null, group_ids: groupIds } });
      } else if (classIds.length) {
        for (const cid of classIds) {
          await notifyStudents({ title: "📚 عنصر جديد في بنك الأسئلة", body, type: "question_bank", link, dedupe_key,
            target: { kind: "class", class_id: cid } });
        }
      } else {
        await notifyStudents({ title: "📚 عنصر جديد في بنك الأسئلة", body, type: "question_bank", link, dedupe_key,
          target: { kind: "all" } });
      }
    }
  } catch (e) { console.error("[notifyBankPublish] failed:", e); }
}


// ---------- Types ----------
export type QBEntry = {
  id: string;
  title: string;
  description: string | null;
  entry_type: "question" | "material";
  question_type: "mcq" | "true_false" | "short" | "essay" | "map" | null;
  content: {
    text?: string;
    options?: Array<{ text: string; is_correct: boolean }>;
    correct_answer?: string;
    explanation?: string;
    body?: string;
  };
  attachments: Array<{
    path: string;
    name: string;
    mime: string;
    size: number;
    url?: string; // signed on read
  }>;
  subject: string;
  grade_level: string | null;
  unit: string | null;
  chapter: string | null;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  tags: string[];
  visibility: "private" | "students";
  class_ids: string[];
  group_ids: string[];
  source: "manual" | "ai_generated" | "imported";
  usage_count: number;
  created_at: string;
  updated_at: string;
};


const EntrySchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).nullable().optional(),
  entry_type: z.enum(["question", "material"]).default("question"),
  question_type: z.enum(["mcq", "true_false", "short", "essay", "map"]).nullable().optional(),
  content: z.any().default({}),
  attachments: z.array(z.any()).default([]),
  subject: z.string().default("general"),
  grade_level: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  points: z.number().int().min(0).max(100).default(1),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(["private", "students"]).default("private"),
  class_ids: z.array(z.string().uuid()).default([]),
  group_ids: z.array(z.string().uuid()).default([]),
});


async function assertAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId, _role: "admin",
  });
  if (!isAdmin) throw new Error("مسموح للأدمن فقط");
}

async function signAttachments(atts: any[]): Promise<any[]> {
  if (!Array.isArray(atts) || atts.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out = [];
  for (const a of atts) {
    if (!a?.path) { out.push(a); continue; }
    try {
      const { data } = await supabaseAdmin.storage.from("question-bank").createSignedUrl(a.path, 60 * 60);
      out.push({ ...a, url: data?.signedUrl });
    } catch { out.push(a); }
  }
  return out;
}

// ---------- List (admin: all; student: visibility='students') ----------
export const listQuestionBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    search?: string; subject?: string; entry_type?: string;
    question_type?: string; grade_level?: string; unit?: string;
    difficulty?: string; visibility?: string; tag?: string; limit?: number;
  }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    let q = context.supabase.from("question_bank").select("*").order("created_at", { ascending: false });
    if (!isAdmin) q = q.eq("visibility", "students");
    if (data?.search) q = q.ilike("title", `%${data.search}%`);
    if (data?.subject && data.subject !== "all") q = q.eq("subject", data.subject);
    if (data?.entry_type && data.entry_type !== "all") q = q.eq("entry_type", data.entry_type);
    if (data?.question_type && data.question_type !== "all") q = q.eq("question_type", data.question_type);
    if (data?.grade_level) q = q.eq("grade_level", data.grade_level);
    if (data?.unit) q = q.eq("unit", data.unit);
    if (data?.difficulty && data.difficulty !== "all") q = q.eq("difficulty", data.difficulty);
    if (data?.visibility && data.visibility !== "all") q = q.eq("visibility", data.visibility);
    if (data?.tag) q = q.contains("tags", [data.tag]);
    q = q.limit(Math.min(data?.limit ?? 200, 500));
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const withSigned = await Promise.all(
      (rows ?? []).map(async (r: any) => ({ ...r, attachments: await signAttachments(r.attachments ?? []) })),
    );
    return withSigned as QBEntry[];
  });

// ---------- Get one ----------
export const getQuestionBankEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("question_bank").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("العنصر غير موجود");
    return { ...row, attachments: await signAttachments((row as any).attachments ?? []) } as QBEntry;
  });

// ---------- Create ----------
export const createQuestionBankEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EntrySchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("question_bank").insert({
      ...data, admin_id: context.userId, source: "manual",
    }).select("*").single();
    if (error) throw new Error(error.message);
    if ((row as any)?.visibility === "students") {
      await notifyBankPublish([{ id: (row as any).id, title: (row as any).title, class_ids: (row as any).class_ids, group_ids: (row as any).group_ids }]);
    }
    return row;
  });

// ---------- Update ----------
export const updateQuestionBankEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EntrySchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { data: prev } = await supabaseAdmin.from("question_bank").select("visibility").eq("id", id).maybeSingle();
    const { data: row, error } = await supabaseAdmin.from("question_bank").update(patch).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    if ((prev as any)?.visibility !== "students" && (row as any)?.visibility === "students") {
      await notifyBankPublish([{ id: (row as any).id, title: (row as any).title, class_ids: (row as any).class_ids, group_ids: (row as any).group_ids }]);
    }
    return row;
  });


// ---------- Delete ----------
export const deleteQuestionBankEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Delete attached files first
    const { data: row } = await supabaseAdmin.from("question_bank").select("attachments").eq("id", data.id).maybeSingle();
    const paths = (((row as any)?.attachments as any[]) ?? []).map((a) => a?.path).filter(Boolean);
    if (paths.length) await supabaseAdmin.storage.from("question-bank").remove(paths);
    const { error } = await supabaseAdmin.from("question_bank").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Bulk visibility ----------
export const setBulkVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; visibility: "private" | "students" }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("question_bank").update({ visibility: data.visibility }).in("id", data.ids);
    if (error) throw new Error(error.message);
    if (data.visibility === "students") {
      const { data: rows } = await supabaseAdmin.from("question_bank")
        .select("id,title,class_ids,group_ids").in("id", data.ids);
      await notifyBankPublish((rows ?? []) as any[]);
    }
    return { ok: true, count: data.ids.length };
  });

// ---------- Bulk targeting (classes / groups) ----------
export const setBulkTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; class_ids: string[]; group_ids: string[] }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("question_bank")
      .update({ class_ids: data.class_ids, group_ids: data.group_ids })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    const { data: rows } = await supabaseAdmin.from("question_bank")
      .select("title,class_ids,group_ids,visibility").in("id", data.ids);
    const published = (rows ?? []).filter((r: any) => r.visibility === "students");
    if (published.length) notifyBankPublish(published as any[]);
    return { ok: true, count: data.ids.length };
  });




// ---------- Generate signed upload URL for attachment ----------
export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filename: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clean = data.filename.replace(/[^\w.\-]+/g, "_");
    const path = `${context.userId}/${Date.now()}_${clean}`;
    const { data: signed, error } = await supabaseAdmin.storage.from("question-bank").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

// ---------- Generate questions with AI ----------
const AttachmentSchema = z.object({
  kind: z.enum(["image", "file"]),
  mime: z.string(),
  name: z.string().optional(),
  dataUrl: z.string(),
});

const GenSchema = z.object({
  prompt: z.string().max(4000).optional().default(""),
  count: z.number().int().min(1).max(20).default(5),
  subject: z.string().default("general"),
  grade_level: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  question_type: z.enum(["mcq", "true_false", "short", "essay"]).default("mcq"),
  save_to_bank: z.boolean().default(true),
  attachments: z.array(AttachmentSchema).default([]),
});

export const generateQuestionsWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.prompt?.trim() && (!data.attachments || data.attachments.length === 0)) {
      throw new Error("اكتب موضوعاً أو أرفق ملفاً/صورة/فيديو");
    }
    const { callAI, parseJsonReply } = await import("@/lib/ai/router.server");

    const typeInstruction: Record<string, string> = {
      mcq: 'كل سؤال له 4 خيارات مع تحديد الإجابة الصحيحة.',
      true_false: 'كل سؤال إجابته "صح" أو "خطأ".',
      short: 'كل سؤال إجابته نصية قصيرة (كلمة أو جملة).',
      essay: 'كل سؤال مقالي (إجابة تفصيلية).',
    };

    const sys = `أنت خبير تربوي في الدراسات الاجتماعية. حلّل أي مرفق (صورة/فيديو/PDF/ملف) واستخرج منه أهم النقاط ثم اكتب أسئلة عربية دقيقة بتنسيق JSON فقط.`;
    const userText = `اكتب ${data.count} سؤال بمستوى صعوبة "${data.difficulty}" ${data.prompt?.trim() ? `حول: ${data.prompt}` : "بناءً على المرفقات"}.
${typeInstruction[data.question_type]}
أعد JSON بالشكل:
{ "questions": [ { "text": "...", "options": [{"text":"..","is_correct":true},...], "correct_answer": "...", "explanation": "..." } ] }
- options فقط لأسئلة MCQ.
- correct_answer نص الإجابة الصحيحة (لـ true_false: "صح" أو "خطأ").
- explanation شرح موجز.`;

    const parts: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
    for (const a of data.attachments ?? []) {
      if (a.kind === "image" || a.mime.startsWith("image/")) {
        parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
      } else {
        parts.push({ type: "file", file: { filename: a.name ?? "file", file_data: a.dataUrl } });
      }
    }

    const hasAttachments = (data.attachments?.length ?? 0) > 0;
    const taskType = hasAttachments ? "admin_assistant_file" : "exam_generate";

    const result = await callAI(taskType as any, [
      { role: "system", content: sys },
      { role: "user", content: hasAttachments ? (parts as any) : userText },
    ], {
      responseJson: true,
      userId: context.userId,
      role: "admin",
    });


    const parsed = parseJsonReply<{ questions: any[] }>(result.text);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

    const entries = questions.map((q) => ({
      admin_id: context.userId,
      title: String(q.text ?? "").slice(0, 200) || "سؤال جديد",
      entry_type: "question" as const,
      question_type: data.question_type,
      content: {
        text: q.text,
        options: Array.isArray(q.options) ? q.options : undefined,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
      },
      attachments: [],
      subject: data.subject,
      grade_level: data.grade_level ?? null,
      unit: data.unit ?? null,
      difficulty: data.difficulty,
      points: 1,
      tags: [],
      visibility: "private" as const,
      source: "ai_generated" as const,
    }));

    if (data.save_to_bank && entries.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("question_bank").insert(entries);
    }

    return { entries, count: entries.length, model: result.model, cached: result.cached };
  });

// ---------- Add bank items to an exam ----------
export const addBankItemsToExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { exam_id: string; bank_ids: string[] }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: items, error } = await supabaseAdmin
      .from("question_bank").select("*").in("id", data.bank_ids);
    if (error) throw new Error(error.message);

    const { data: countRow } = await supabaseAdmin
      .from("questions").select("order_index").eq("exam_id", data.exam_id)
      .order("order_index", { ascending: false }).limit(1).maybeSingle();
    let nextIdx = ((countRow as any)?.order_index ?? -1) + 1;

    for (const it of items ?? []) {
      const c: any = it.content ?? {};
      if (it.entry_type !== "question") continue;
      const { data: qRow, error: qErr } = await supabaseAdmin.from("questions").insert({
        exam_id: data.exam_id,
        text: c.text ?? it.title,
        type: it.question_type ?? "short",
        points: it.points ?? 1,
        explanation: c.explanation ?? null,
        correct_answer: c.correct_answer ?? null,
        order_index: nextIdx++,
      }).select("id").single();
      if (qErr || !qRow) continue;
      if (Array.isArray(c.options) && c.options.length) {
        await supabaseAdmin.from("question_options").insert(
          c.options.map((o: any, i: number) => ({
            question_id: qRow.id, text: o.text, is_correct: !!o.is_correct, order_index: i,
          })),
        );
      }
      await supabaseAdmin.from("question_bank")
        .update({ usage_count: (it.usage_count ?? 0) + 1 })
        .eq("id", it.id);
    }
    return { ok: true, count: (items ?? []).length };
  });

// ---------- Create a new exam from selected bank items ----------
export const createExamFromBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; bank_ids: string[]; duration_minutes?: number }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam, error } = await supabaseAdmin.from("exams").insert({
      title: data.title,
      duration_minutes: data.duration_minutes ?? 30,
      created_by: context.userId,
      published: false,
    }).select("id").single();
    if (error || !exam) throw new Error(error?.message ?? "فشل إنشاء الامتحان");

    await addBankItemsToExam({ data: { exam_id: exam.id, bank_ids: data.bank_ids } });
    return { exam_id: exam.id };
  });
