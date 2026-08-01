import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ingestSnippet } from "@/lib/ai/kb-ingest.server";
import { getStudentClass } from "@/lib/ai/kb-search.server";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

/** Student escalates a question the assistant could not ground in the curriculum. */
export const askTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ question: z.string().min(3), aiDraft: z.string().nullable().default(null) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { studentId, classId } = await getStudentClass(context.userId);
    const { error } = await context.supabase.from("teacher_questions").insert({
      student_id: studentId,
      user_id: context.userId,
      class_id: classId,
      question: data.question.slice(0, 2000),
      ai_draft: data.aiDraft?.slice(0, 4000) ?? null,
      status: "pending",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTeacherQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.string().nullable().default(null) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("teacher_questions")
      .select("id, question, ai_draft, answer, status, added_to_kb, created_at, answered_at, class_id, students(full_name, code), classes(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { questions: rows ?? [] };
  });

/** Teacher answers; the answer is optionally added to the knowledge base. */
export const answerTeacherQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      answer: z.string().min(2),
      addToKb: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("غير مصرح");

    const { data: row } = await context.supabase
      .from("teacher_questions")
      .select("id, question, class_id, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("السؤال غير موجود");

    let addedToKb = false;
    if (data.addToKb) {
      try {
        await ingestSnippet({
          title: `إجابة المدرس: ${(row as any).question.slice(0, 60)}`,
          classId: (row as any).class_id ?? null,
          heading: (row as any).question.slice(0, 120),
          content: `سؤال: ${(row as any).question}\nالإجابة: ${data.answer}`,
          docType: "answer",
        });
        addedToKb = true;
      } catch {
        addedToKb = false;
      }
    }

    const { error } = await context.supabase
      .from("teacher_questions")
      .update({
        answer: data.answer,
        status: "answered",
        added_to_kb: addedToKb,
        answered_by: context.userId,
        answered_at: new Date().toISOString(),
      } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Notify the student.
    if ((row as any).user_id) {
      await context.supabase.from("notifications").insert({
        user_id: (row as any).user_id,
        title: "إجابة المدرس على سؤالك",
        body: data.answer.slice(0, 200),
        type: "info",
        link: "/student/assistant",
      } as any);
    }

    return { ok: true, addedToKb };
  });

export const myTeacherQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("teacher_questions")
      .select("id, question, answer, status, created_at, answered_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { questions: data ?? [] };
  });
