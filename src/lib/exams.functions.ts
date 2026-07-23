import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeGrade, evalMapSubQuestion, textAnswerMatches } from "./exam-utils";

const AntiCheat = z.object({
  block_copy: z.boolean().optional(),
  block_paste: z.boolean().optional(),
  single_device: z.boolean().optional(),
  track_leaves: z.boolean().optional(),
  track_time: z.boolean().optional(),
  track_ip: z.boolean().optional(),
}).default({});

const ExamInput = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  class_id: z.string().uuid().nullable().optional(),
  group_ids: z.array(z.string().uuid()).default([]),
  total_score: z.number().min(0).default(0),
  duration_minutes: z.number().int().min(1).max(600).default(30),
  attempts_allowed: z.number().int().min(1).max(20).default(1),
  show_result_mode: z.enum(["immediate", "after_review"]).default("immediate"),
  status: z.enum(["draft", "published", "scheduled", "ended"]).default("draft"),
  published: z.boolean().default(false),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  shuffle_questions: z.boolean().default(false),
  shuffle_options: z.boolean().default(false),
  num_variants: z.number().int().min(1).max(10).default(1),
  anti_cheat: AntiCheat,
});

const QuestionInput = z.object({
  id: z.string().uuid().optional(),
  type: z.string(),
  text: z.string().min(1),
  image_url: z.string().nullable().optional(),
  file_url: z.string().nullable().optional(),
  points: z.number().min(0).default(1),
  suggested_time_sec: z.number().int().nullable().optional(),
  explanation: z.string().nullable().optional(),
  order_index: z.number().int().default(0),
  correct_answer: z.any().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  options: z.array(z.object({
    text: z.string(),
    image_url: z.string().nullable().optional(),
    is_correct: z.boolean().default(false),
    order_index: z.number().int().default(0),
    match_key: z.string().nullable().optional(),
  })).default([]),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("مسموح للأدمن فقط");
}

export const upsertExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid().optional(), patch: ExamInput.partial() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data.patch, created_by: context.userId };
    if (data.id && payload.published === true) {
      const { count, error: countErr } = await supabaseAdmin
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("exam_id", data.id);
      if (countErr) throw new Error(countErr.message);
      if ((count ?? 0) === 0) throw new Error("لا يمكن نشر امتحان بدون أسئلة");
    }
    if (data.id) {
      const { data: prev } = await supabaseAdmin.from("exams").select("published").eq("id", data.id).maybeSingle();
      const { error } = await supabaseAdmin.from("exams").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      if (payload.published === true && prev && !prev.published) {
        try {
          const { notifyStudents } = await import("./notify-helpers.server");
          await notifyStudents({
            title: "📝 امتحان جديد",
            body: `تم نشر امتحان: ${payload.title ?? ""}`,
            type: "exam",
            link: `/student/exams/${data.id}`,
            target: { kind: "classes_groups", class_id: payload.class_id ?? null, group_ids: payload.group_ids ?? [] },
          });
        } catch {}
      }
      return { id: data.id };
    } else {
      if (!payload.title) payload.title = "امتحان جديد";
      const { data: row, error } = await supabaseAdmin.from("exams").insert(payload).select("id").single();
      if (error || !row) throw new Error(error?.message ?? "فشل الإنشاء");
      if (payload.published === true) {
        try {
          const { notifyStudents } = await import("./notify-helpers.server");
          await notifyStudents({
            title: "📝 امتحان جديد",
            body: `تم نشر امتحان: ${payload.title ?? ""}`,
            type: "exam",
            link: `/student/exams/${row.id}`,
            target: { kind: "classes_groups", class_id: payload.class_id ?? null, group_ids: payload.group_ids ?? [] },
          });
        } catch {}
      }
      return { id: row.id };
    }

  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("exams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), published: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.published) {
      const { count, error: countErr } = await supabaseAdmin
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("exam_id", data.id);
      if (countErr) throw new Error(countErr.message);
      if ((count ?? 0) === 0) throw new Error("لا يمكن نشر امتحان بدون أسئلة");
    }
    const status = data.published ? "published" : "draft";
    const { data: prev } = await supabaseAdmin.from("exams").select("published,title,class_id,group_ids").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.from("exams").update({ published: data.published, status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    // Notify students on transition draft -> published
    if (data.published && prev && !prev.published) {
      try {
        const { notifyStudents } = await import("./notify-helpers.server");
        await notifyStudents({
          title: "📝 امتحان جديد",
          body: `تم نشر امتحان: ${prev.title ?? ""}`,
          type: "exam",
          link: `/student/exams/${data.id}`,
          target: { kind: "classes_groups", class_id: prev.class_id, group_ids: prev.group_ids ?? [] },
        });
      } catch {}
    }
    return { ok: true };
  });


export const saveQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ exam_id: z.string().uuid(), questions: z.array(QuestionInput) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingRows, error: existingErr } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("exam_id", data.exam_id);
    if (existingErr) throw new Error(existingErr.message);

    const existingIds = new Set((existingRows ?? []).map((q: any) => q.id as string));
    const keptIds: string[] = [];
    let totalScore = 0;

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      const questionPoints = getQuestionMaxPoints(q);
      totalScore += questionPoints;
      const payload = {
        exam_id: data.exam_id,
        type: q.type,
        text: q.text,
        image_url: q.image_url ?? null,
        file_url: q.file_url ?? null,
        points: questionPoints,
        suggested_time_sec: q.suggested_time_sec ?? null,
        explanation: q.explanation ?? null,
        order_index: i,
        correct_answer: q.correct_answer ?? null,
        difficulty: q.difficulty ?? null,
      };

      const { data: qRow, error: qErr } = q.id && existingIds.has(q.id)
        ? await supabaseAdmin.from("questions").update(payload).eq("id", q.id).eq("exam_id", data.exam_id).select("id").single()
        : await supabaseAdmin.from("questions").insert(payload).select("id").single();
      if (qErr || !qRow) throw new Error(qErr?.message ?? "فشل حفظ سؤال");
      keptIds.push(qRow.id);

      const { error: delOptErr } = await supabaseAdmin.from("question_options").delete().eq("question_id", qRow.id);
      if (delOptErr) throw new Error(delOptErr.message);
      if (q.options && q.options.length) {
        const optRows = q.options.map((o, oi) => ({
          question_id: qRow.id,
          text: o.text,
          image_url: o.image_url ?? null,
          is_correct: o.is_correct,
          order_index: oi,
          match_key: o.match_key ?? null,
        }));
        const { error: oErr } = await supabaseAdmin.from("question_options").insert(optRows);
        if (oErr) throw new Error(oErr.message);
      }
    }

    const removedIds = [...existingIds].filter((qid) => !keptIds.includes(qid));
    if (removedIds.length > 0) {
      const { error: delErr } = await supabaseAdmin.from("questions").delete().in("id", removedIds).eq("exam_id", data.exam_id);
      if (delErr) throw new Error(delErr.message);
    }

    const examPatch: any = { total_score: totalScore };
    if (data.questions.length === 0) {
      examPatch.published = false;
      examPatch.status = "draft";
    }
    await supabaseAdmin.from("exams").update(examPatch).eq("id", data.exam_id);
    return { ok: true, total_score: totalScore, count: data.questions.length };
  });

// ---------------- Student attempt lifecycle ----------------

export const startAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ exam_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: student } = await supabase.from("students").select("id,status").eq("user_id", userId).maybeSingle();
    if (!student) throw new Error("الطالب غير مسجل");
    if (student.status === "suspended") throw new Error("الحساب موقوف");

    const { data: exam, error: eErr } = await supabase
      .from("exams")
      .select("id,published,attempts_allowed,starts_at,ends_at,status")
      .eq("id", data.exam_id).maybeSingle();
    if (eErr || !exam) throw new Error("الامتحان غير موجود");
    if (!exam.published) throw new Error("الامتحان غير منشور");
    const now = Date.now();
    if (exam.starts_at && new Date(exam.starts_at).getTime() > now) throw new Error("الامتحان لم يبدأ بعد");
    if (exam.ends_at && new Date(exam.ends_at).getTime() < now) throw new Error("انتهى وقت الامتحان");

    // Check attempts count
    const { count } = await supabase.from("exam_attempts").select("id", { count: "exact", head: true })
      .eq("exam_id", data.exam_id).eq("student_id", student.id);
    // Check for existing in_progress
    const { data: inProgress } = await supabase.from("exam_attempts").select("id,status")
      .eq("exam_id", data.exam_id).eq("student_id", student.id).eq("status", "in_progress").maybeSingle();
    if (inProgress) return { attempt_id: inProgress.id, resumed: true };
    if ((count ?? 0) >= (exam.attempts_allowed ?? 1)) throw new Error("تم استنفاد عدد المحاولات المسموح بها");

    const { data: att, error: aErr } = await supabase.from("exam_attempts").insert({
      exam_id: data.exam_id, student_id: student.id, user_id: userId, status: "in_progress",
    }).select("id").single();
    if (aErr || !att) throw new Error(aErr?.message ?? "فشل بدء المحاولة");
    return { attempt_id: att.id, resumed: false };
  });

export const saveAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    attempt_id: z.string().uuid(),
    question_id: z.string().uuid(),
    answer: z.any(),
    time_spent_sec: z.number().int().default(0),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("attempt_answers").upsert({
      attempt_id: data.attempt_id, question_id: data.question_id,
      answer: data.answer, time_spent_sec: data.time_spent_sec,
    }, { onConflict: "attempt_id,question_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ attempt_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cur } = await supabase.from("exam_attempts").select("leave_events").eq("id", data.attempt_id).maybeSingle();
    await supabase.from("exam_attempts").update({ leave_events: (cur?.leave_events ?? 0) + 1 }).eq("id", data.attempt_id);
    return { ok: true };
  });

function getMapQuestionWeight(correctAnswer: any): number {
  const expectedPoints: any[] = Array.isArray(correctAnswer?.points)
    ? correctAnswer.points
    : Array.isArray(correctAnswer)
    ? correctAnswer
    : [];
  return expectedPoints.reduce((sum, p) => {
    const subs: any[] = Array.isArray(p?.questions) ? p.questions : [];
    const subWeight = subs.reduce((s, sq) => s + Math.max(0, Number(sq.points) || 0), 0);
    return sum + (subWeight > 0 ? subWeight : 1);
  }, 0);
}

function getQuestionMaxPoints(q: any): number {
  if (q?.type === "map") {
    const mapWeight = getMapQuestionWeight(q.correct_answer);
    if (mapWeight > 0) return mapWeight;
  }
  return Math.max(0, Number(q?.points) || 0);
}

function evaluateObjective(q: any, ans: any): { correct: boolean | null; points: number; needsReview?: boolean } {
  const pts = getQuestionMaxPoints(q);
  if (ans == null) return { correct: null, points: 0 };
  switch (q.type) {
    case "mcq": {
      const correctIds = (q.question_options ?? []).filter((o: any) => o.is_correct).map((o: any) => o.id).sort();
      const given = Array.isArray(ans) ? [...ans].sort() : [ans];
      const ok = JSON.stringify(correctIds) === JSON.stringify(given);
      return { correct: ok, points: ok ? pts : 0 };
    }
    case "true_false": {
      const ok = String(ans) === String(q.correct_answer);
      return { correct: ok, points: ok ? pts : 0 };
    }
    case "complete": {
      const expected = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
      const ok = expected.some((item: any) => textAnswerMatches(item, ans));
      return { correct: ok, points: ok ? pts : 0 };
    }
    case "order": {
      const expected = JSON.stringify(q.correct_answer ?? []);
      const ok = JSON.stringify(ans ?? []) === expected;
      return { correct: ok, points: ok ? pts : 0 };
    }
    case "match": {
      const expected = q.correct_answer ?? {};
      let matched = 0, total = 0;
      for (const k of Object.keys(expected)) { total++; if (String(ans?.[k]) === String(expected[k])) matched++; }
      if (!total) return { correct: null, points: 0 };
      const partial = pts * (matched / total);
      return { correct: matched === total, points: Math.round(partial * 100) / 100 };
    }
    case "map": {
      const expectedPoints: any[] = Array.isArray(q.correct_answer?.points)
        ? q.correct_answer.points
        : Array.isArray(q.correct_answer)
        ? q.correct_answer
        : [];
      if (!expectedPoints.length) return { correct: null, points: 0 };
      const givenLabels: string[] = Array.isArray(ans?.labels)
        ? ans.labels
        : Array.isArray(ans) ? ans : [];
      const givenItems: Record<string, Record<string, any>> =
        ans?.items && typeof ans.items === "object" ? ans.items : {};
      let totalWeight = 0, awarded = 0, needsReview = false, anyAnswered = false;
      expectedPoints.forEach((p: any, pi: number) => {
        const subs: any[] = Array.isArray(p?.questions) ? p.questions : [];
        if (subs.length > 0) {
          subs.forEach((sq: any) => {
            const w = Number(sq.points) || 0;
            if (w <= 0) {
              if (sq.type === "essay") needsReview = true;
              return;
            }
            totalWeight += w;
            const a = givenItems[String(pi)]?.[sq.id];
            if (a != null && a !== "") anyAnswered = true;
            const ev = evalMapSubQuestion(sq, a);
            const acceptsPointLabel = (sq.type === "short" || sq.type === "complete") && textAnswerMatches(p?.label, a);
            awarded += acceptsPointLabel ? w : ev.points;
            if (ev.needsReview) needsReview = true;
          });
        } else {
          totalWeight += 1;
          if (String(givenLabels[pi] ?? "").trim()) anyAnswered = true;
          if (textAnswerMatches(p?.label, givenLabels[pi])) awarded += 1;
        }
      });
      if (!anyAnswered) return { correct: null, points: 0, needsReview };
      const raw = totalWeight > 0 ? (awarded / totalWeight) * pts : 0;
      const rounded = Math.round(raw * 100) / 100;
      const correct = needsReview ? null : rounded === pts;
      return { correct, points: rounded, needsReview };
    }
    default:
      return { correct: null, points: 0 };
  }
}

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ attempt_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: att, error: aErr } = await supabase.from("exam_attempts")
      .select("id,exam_id,student_id,started_at,status").eq("id", data.attempt_id).maybeSingle();
    if (aErr || !att) throw new Error("المحاولة غير موجودة");
    if (att.status !== "in_progress") throw new Error("تم تسليم هذه المحاولة");

    // Use admin client for grading writes — student RLS/triggers block scoring fields.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: questions } = await supabaseAdmin.from("questions")
      .select("id,type,points,correct_answer,question_options(id,is_correct)")
      .eq("exam_id", att.exam_id);

    const { data: answers } = await supabaseAdmin.from("attempt_answers")
      .select("question_id,answer").eq("attempt_id", att.id);
    const ansMap = new Map((answers ?? []).map((a: any) => [a.question_id, a.answer]));

    let score = 0, total = 0, needsReview = false;
    for (const q of questions ?? []) {
      total += getQuestionMaxPoints(q);
      const ans = ansMap.get(q.id);
      if (q.type === "essay") {
        needsReview = true;
        await supabaseAdmin.from("attempt_answers").upsert({
          attempt_id: att.id, question_id: q.id, answer: ans ?? null,
          is_correct: null, awarded_points: null,
        }, { onConflict: "attempt_id,question_id" });
        continue;
      }
      const ev = evaluateObjective(q, ans);
      score += ev.points;
      if (ev.needsReview) needsReview = true;
      await supabaseAdmin.from("attempt_answers").upsert({
        attempt_id: att.id, question_id: q.id, answer: ans ?? null,
        is_correct: ev.needsReview ? null : ev.correct,
        awarded_points: ev.points,
      }, { onConflict: "attempt_id,question_id" });
    }

    const pct = total > 0 ? Math.round((score / total) * 10000) / 100 : 0;
    const timeSpent = Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000);

    // Auto-award points + auto-approve when fully auto-graded (no essay review needed).
    // Compute points OUTSIDE any try/catch so failures surface instead of silently
    // dropping approval — that's what caused map-exam attempts to stay approved=false
    // and points_awarded=0 for high-scoring students.
    const autoApproved = !needsReview;
    let autoPointsAwarded = 0;
    if (autoApproved) {
      try {
        autoPointsAwarded = await awardAttemptPoints(supabaseAdmin, { percentage: pct });
      } catch (e) {
        console.error("[submitAttempt] awardAttemptPoints failed:", e);
        autoPointsAwarded = 0; // still auto-approve; admin can adjust manually
      }
    }

    const { error: upErr } = await supabaseAdmin.from("exam_attempts").update({
      status: needsReview ? "submitted" : "graded",
      submitted_at: new Date().toISOString(),
      score, total, percentage: pct, grade: computeGrade(pct),
      needs_review: needsReview, time_spent_sec: timeSpent,
      ...(autoApproved ? {
        approved: true,
        approved_at: new Date().toISOString(),
        points_awarded: autoPointsAwarded,
      } : {}),
    }).eq("id", att.id);
    if (upErr) throw new Error(upErr.message);

    // Credit student points immediately for auto-graded attempts (map + objective).
    if (autoApproved && autoPointsAwarded > 0) {
      try {
        await creditStudentPoints(supabaseAdmin, {
          student_id: att.student_id, exam_id: att.exam_id, points: autoPointsAwarded,
          reason_prefix: "امتحان",
        });
      } catch (e) {
        console.error("[submitAttempt] creditStudentPoints failed:", e);
      }
    }
    if (autoApproved) {
      await evaluateAchievementsAndBadges(supabaseAdmin, att.student_id);
    }

    // Save to results table (for legacy compatibility)
    await supabaseAdmin.from("results").insert({
      exam_id: att.exam_id, student_id: att.student_id, score, total,
    });

    // In-app notification for the student (linked to the result page)
    // + notify all admins so they can send the WhatsApp result to the parent.
    try {
      const { data: stu } = await supabaseAdmin
        .from("students").select("user_id,full_name,code").eq("id", att.student_id).maybeSingle();
      const { data: ex } = await supabaseAdmin
        .from("exams").select("title").eq("id", att.exam_id).maybeSingle();
      const { pushToUsers } = await import("./notify-helpers.server");
      if (stu?.user_id) {
        const title = needsReview ? "📝 تم تسليم امتحانك" : "✅ تم تصحيح امتحانك";
        const body = needsReview
          ? `تم تسليم امتحان "${ex?.title ?? ""}" بنجاح، النتيجة قيد المراجعة من المدرس.`
          : `انتهيت من امتحان "${ex?.title ?? ""}" — الدرجة ${score}/${total} (${pct}%)${autoPointsAwarded > 0 ? ` · حصلت على ⭐ ${autoPointsAwarded} نقطة` : ""}.`;
        const link = `/student/exams/${att.exam_id}/result`;
        await supabaseAdmin.from("notifications").insert({
          user_id: stu.user_id, title, body, type: "exam_finished", link,
        });
        await pushToUsers([stu.user_id], { title, body, link });
      }
      // Notify admins → they can send the parent WhatsApp from the results page.
      const { data: admins } = await supabaseAdmin
        .from("admins").select("user_id").not("user_id", "is", null);
      const adminIds = Array.from(new Set((admins ?? []).map((a: any) => a.user_id).filter(Boolean)));
      if (adminIds.length) {
        const title = needsReview ? "📝 طالب سلّم امتحاناً" : "✅ طالب أنهى امتحاناً";
        const body = `${stu?.full_name ?? "طالب"}${stu?.code ? ` (${stu.code})` : ""} — "${ex?.title ?? ""}" · ${score}/${total} (${pct}%)${needsReview ? " · بحاجة تصحيح" : ""}. اضغط لإبلاغ ولي الأمر.`;
        const link = `/admin/exams/${att.exam_id}/results`;
        await supabaseAdmin.from("notifications").insert(
          adminIds.map((uid: string) => ({
            user_id: uid, title, body, type: "exam_submitted_admin", link,
          })),
        );
        await pushToUsers(adminIds, { title, body, link });
      }
    } catch { /* non-blocking */ }

    return { ok: true, score, total, percentage: pct, needs_review: needsReview };
  });


export const gradeEssay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    attempt_id: z.string().uuid(),
    question_id: z.string().uuid(),
    awarded_points: z.number().min(0),
    is_correct: z.boolean().nullable().optional(),
    reasoning: z.string().nullable().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("attempt_answers").update({
      awarded_points: data.awarded_points,
      is_correct: data.is_correct ?? null,
      ai_reasoning: data.reasoning ?? null,
    }).eq("attempt_id", data.attempt_id).eq("question_id", data.question_id);

    // Recompute attempt total
    const { data: rows } = await supabaseAdmin.from("attempt_answers")
      .select("awarded_points").eq("attempt_id", data.attempt_id);
    const score = (rows ?? []).reduce((a: number, r: any) => a + (Number(r.awarded_points) || 0), 0);
    const { data: att } = await supabaseAdmin.from("exam_attempts").select("total").eq("id", data.attempt_id).maybeSingle();
    const total = Number(att?.total) || 0;
    const pct = total > 0 ? Math.round((score / total) * 10000) / 100 : 0;

    // Check if any remaining essays without points
    const { data: pending } = await supabaseAdmin.from("attempt_answers")
      .select("awarded_points,question_id,questions(type)")
      .eq("attempt_id", data.attempt_id);
    const stillNeeds = (pending ?? []).some((r: any) => r.questions?.type === "essay" && r.awarded_points == null);

    await supabaseAdmin.from("exam_attempts").update({
      score, percentage: pct, grade: computeGrade(pct),
      status: stillNeeds ? "submitted" : "graded",
      needs_review: stillNeeds,
    }).eq("id", data.attempt_id);
    return { ok: true, score, percentage: pct };
  });

// ---------------- Phase 4: Approve / edit / reopen / AI grade ----------------

async function logActivity(supabaseAdmin: any, userId: string, action: string, entity_type: string, entity_id: string, details: any = {}) {
  try { await supabaseAdmin.from("activity_log").insert({ user_id: userId, action, entity_type, entity_id, details }); } catch { /* ignore */ }
}

async function awardAttemptPoints(supabaseAdmin: any, attempt: any): Promise<number> {
  const { data: cfg } = await supabaseAdmin.from("settings").select("value").eq("key", "points_config").maybeSingle();
  const c = cfg?.value ?? { per_percent: 1, bonus_pass: 10, bonus_excellent: 25 };
  const pct = Number(attempt.percentage) || 0;
  let pts = Math.round(pct * (c.per_percent ?? 1));
  if (pct >= 50) pts += Number(c.bonus_pass ?? 0);
  if (pct >= 85) pts += Number(c.bonus_excellent ?? 0);
  return pts;
}

// Single source of truth for crediting a student's points balance + level +
// audit log. Used by auto-approved submissions AND admin approvals so both
// paths stay in sync (map exams historically silently skipped this).
//
// IMPORTANT: the `trg_apply_points` DB trigger fires AFTER INSERT on
// points_log and already bumps students.points, recomputes the level, and
// inserts the student notification. We must NOT also update students.points
// here or every approval double-counts.
async function creditStudentPoints(
  supabaseAdmin: any,
  opts: { student_id: string; exam_id: string; points: number; reason_prefix: string },
): Promise<void> {
  if (!opts.points || opts.points <= 0) return;
  const { data: ex } = await supabaseAdmin.from("exams").select("title").eq("id", opts.exam_id).maybeSingle();
  const { error } = await supabaseAdmin.from("points_log").insert({
    student_id: opts.student_id, points: opts.points,
    reason: `${opts.reason_prefix}: ${ex?.title ?? ""}`,
  });
  if (error) throw new Error(`points_log insert failed: ${error.message}`);
}

// Evaluate active achievements & badges for a student and unlock any newly
// satisfied ones. Uses the admin client so it works during auto-grade paths
// where the RLS user context may not permit inserting into student_* tables.
async function evaluateAchievementsAndBadges(supabaseAdmin: any, studentId: string): Promise<void> {
  try {
    const [stuRes, examRes, achRes, badgeRes, mineAch, mineBadge] = await Promise.all([
      supabaseAdmin.from("students").select("user_id,points,level").eq("id", studentId).maybeSingle(),
      supabaseAdmin.from("exam_attempts").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("approved", true),
      supabaseAdmin.from("achievements").select("*").eq("active", true),
      supabaseAdmin.from("badges").select("*").eq("active", true),
      supabaseAdmin.from("student_achievements").select("achievement_id").eq("student_id", studentId),
      supabaseAdmin.from("student_badges").select("badge_id").eq("student_id", studentId),
    ]);
    const points = Number(stuRes.data?.points) || 0;
    const level = Number(stuRes.data?.level) || 1;
    const examCount = examRes.count ?? 0;
    const userId = stuRes.data?.user_id ?? null;
    const gotAch = new Set((mineAch.data ?? []).map((r: any) => r.achievement_id));
    const gotBadge = new Set((mineBadge.data ?? []).map((r: any) => r.badge_id));

    const meets = (t: string | null, v: number | null) => {
      const val = Number(v) || 0;
      if (t === "exam_count") return examCount >= val;
      if (t === "points") return points >= val;
      if (t === "level") return level >= val;
      return false;
    };

    for (const a of achRes.data ?? []) {
      if (gotAch.has(a.id)) continue;
      if (!meets(a.condition_type, a.condition_value)) continue;
      const { error } = await supabaseAdmin.from("student_achievements").insert({ student_id: studentId, achievement_id: a.id });
      if (error) continue;
      if (Number(a.points_reward) > 0) {
        await supabaseAdmin.from("points_log").insert({
          student_id: studentId, points: Number(a.points_reward), reason: `مكافأة إنجاز: ${a.name}`,
        }).catch(() => {});
      }
      if (userId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: userId, title: "🏆 إنجاز جديد",
          body: `مبروك! حصلت على إنجاز: ${a.name}`,
          type: "achievement", link: "/student/achievements",
        }).catch(() => {});
      }
    }

    for (const b of badgeRes.data ?? []) {
      if (gotBadge.has(b.id)) continue;
      if (!meets(b.condition_type, b.condition_value)) continue;
      const { error } = await supabaseAdmin.from("student_badges").insert({ student_id: studentId, badge_id: b.id });
      if (error) continue;
      if (userId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: userId, title: "🎖️ شارة جديدة",
          body: `حصلت على شارة: ${b.name}`,
          type: "badge", link: "/student/achievements",
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("[evaluateAchievementsAndBadges] failed:", e);
  }
}

export const approveAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    attempt_id: z.string().uuid(),
    admin_notes: z.string().nullable().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: att } = await supabaseAdmin.from("exam_attempts")
      .select("id,student_id,exam_id,percentage,approved,points_awarded,exams(title)").eq("id", data.attempt_id).maybeSingle();
    if (!att) throw new Error("المحاولة غير موجودة");
    if (att.approved) throw new Error("النتيجة معتمدة مسبقًا");

    const pts = await awardAttemptPoints(supabaseAdmin, att);
    await supabaseAdmin.from("exam_attempts").update({
      approved: true, approved_at: new Date().toISOString(), approved_by: context.userId,
      admin_notes: data.admin_notes ?? null, points_awarded: pts, status: "graded",
    }).eq("id", data.attempt_id);

    if (pts > 0) {
      await creditStudentPoints(supabaseAdmin, {
        student_id: att.student_id, exam_id: att.exam_id, points: pts,
        reason_prefix: "اعتماد نتيجة امتحان",
      });
    }

    await logActivity(supabaseAdmin, context.userId, "approve_attempt", "exam_attempt", att.id, { points_awarded: pts });

    // Notify the student that their result was published/approved.
    try {
      const { data: stu } = await supabaseAdmin
        .from("students").select("user_id").eq("id", att.student_id).maybeSingle();
      if (stu?.user_id) {
        const title = "🏆 تم إعلان نتيجة امتحانك";
        const body = `تم اعتماد نتيجة امتحان "${att.exams?.title ?? ""}"${pts > 0 ? ` — حصلت على ${pts} نقطة` : ""}. اضغط لعرض التفاصيل.`;
        const link = `/student/exams/${att.exam_id}/result`;
        await supabaseAdmin.from("notifications").insert({
          user_id: stu.user_id, title, body, type: "exam_graded", link,
        });
        const { pushToUsers } = await import("./notify-helpers.server");
        await pushToUsers([stu.user_id], { title, body, link });
      }
    } catch { /* non-blocking */ }

    return { ok: true, points_awarded: pts };
  });

export const updateAttemptScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    attempt_id: z.string().uuid(),
    score: z.number().min(0),
    admin_notes: z.string().nullable().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: att } = await supabaseAdmin.from("exam_attempts").select("total,approved").eq("id", data.attempt_id).maybeSingle();
    if (!att) throw new Error("المحاولة غير موجودة");
    if (att.approved) throw new Error("لا يمكن تعديل نتيجة معتمدة، افتحها للتعديل أولًا");
    const total = Number(att.total) || 0;
    const pct = total > 0 ? Math.round((data.score / total) * 10000) / 100 : 0;
    await supabaseAdmin.from("exam_attempts").update({
      score: data.score, percentage: pct, grade: computeGrade(pct),
      admin_notes: data.admin_notes ?? null,
    }).eq("id", data.attempt_id);
    await logActivity(supabaseAdmin, context.userId, "edit_score", "exam_attempt", data.attempt_id, { new_score: data.score });
    return { ok: true };
  });

export const regradeAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ attempt_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: att, error: aErr } = await supabaseAdmin.from("exam_attempts")
      .select("id,exam_id,student_id,started_at,status,approved,submitted_at")
      .eq("id", data.attempt_id)
      .maybeSingle();
    if (aErr || !att) throw new Error("المحاولة غير موجودة");
    if (att.status === "in_progress") throw new Error("لا يمكن تصحيح محاولة لم يتم تسليمها بعد");
    if (att.approved) throw new Error("لا يمكن إعادة تصحيح نتيجة معتمدة، افتحها للتعديل أولًا");

    const { data: questions } = await supabaseAdmin.from("questions")
      .select("id,type,points,correct_answer,question_options(id,is_correct)")
      .eq("exam_id", att.exam_id);
    const { data: answers } = await supabaseAdmin.from("attempt_answers")
      .select("question_id,answer")
      .eq("attempt_id", att.id);
    const ansMap = new Map((answers ?? []).map((a: any) => [a.question_id, a.answer]));

    let score = 0, total = 0, needsReview = false;
    for (const q of questions ?? []) {
      total += getQuestionMaxPoints(q);
      const ans = ansMap.get(q.id);
      if (q.type === "essay") {
        needsReview = true;
        await supabaseAdmin.from("attempt_answers").upsert({
          attempt_id: att.id, question_id: q.id, answer: ans ?? null,
          is_correct: null, awarded_points: null,
        }, { onConflict: "attempt_id,question_id" });
        continue;
      }
      const ev = evaluateObjective(q, ans);
      score += ev.points;
      if (ev.needsReview) needsReview = true;
      await supabaseAdmin.from("attempt_answers").upsert({
        attempt_id: att.id, question_id: q.id, answer: ans ?? null,
        is_correct: ev.needsReview ? null : ev.correct,
        awarded_points: ev.points,
      }, { onConflict: "attempt_id,question_id" });
    }

    const pct = total > 0 ? Math.round((score / total) * 10000) / 100 : 0;
    await supabaseAdmin.from("exam_attempts").update({
      status: needsReview ? "submitted" : "graded",
      submitted_at: att.submitted_at ?? new Date().toISOString(),
      score, total, percentage: pct, grade: computeGrade(pct),
      needs_review: needsReview,
    }).eq("id", att.id);

    await supabaseAdmin.from("results")
      .update({ score, total })
      .eq("exam_id", att.exam_id)
      .eq("student_id", att.student_id);
    await logActivity(supabaseAdmin, context.userId, "regrade_attempt", "exam_attempt", att.id, { score, total, percentage: pct });
    return { ok: true, score, total, percentage: pct, needs_review: needsReview };
  });

export const reopenAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ attempt_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Revert points if any
    const { data: att } = await supabaseAdmin.from("exam_attempts").select("id,student_id,points_awarded,approved").eq("id", data.attempt_id).maybeSingle();
    if (!att) throw new Error("المحاولة غير موجودة");
    if ((Number(att.points_awarded) || 0) > 0) {
      const pts = -Number(att.points_awarded);
      await supabaseAdmin.from("points_log").insert({ student_id: att.student_id, points: pts, reason: "إعادة فتح امتحان — إلغاء النقاط" });
      const { data: stu } = await supabaseAdmin.from("students").select("points").eq("id", att.student_id).maybeSingle();
      const total = Math.max(0, (Number(stu?.points) || 0) + pts);
      await supabaseAdmin.from("students").update({ points: total, level: Math.max(1, Math.floor(total / 100) + 1) }).eq("id", att.student_id);
    }
    await supabaseAdmin.from("exam_attempts").update({
      status: "in_progress", approved: false, approved_at: null, approved_by: null,
      points_awarded: 0, submitted_at: null, needs_review: false,
    }).eq("id", data.attempt_id);
    await logActivity(supabaseAdmin, context.userId, "reopen_attempt", "exam_attempt", data.attempt_id);
    return { ok: true };
  });

export const aiSuggestEssayGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    attempt_id: z.string().uuid(),
    question_id: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q } = await supabaseAdmin.from("questions").select("text,points,explanation,correct_answer").eq("id", data.question_id).maybeSingle();
    const { data: a } = await supabaseAdmin.from("attempt_answers").select("answer").eq("attempt_id", data.attempt_id).eq("question_id", data.question_id).maybeSingle();
    if (!q || !a) throw new Error("لم يتم العثور على السؤال أو الإجابة");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("مفتاح الذكاء الاصطناعي غير مهيأ");

    const studentAns = typeof a.answer === "string" ? a.answer : JSON.stringify(a.answer);
    const prompt = `أنت مصحّح خبير في مادة الدراسات الاجتماعية.
السؤال: ${q.text}
الدرجة الكلية: ${q.points}
الإجابة النموذجية/الشرح: ${q.correct_answer ?? q.explanation ?? "غير محدد"}
إجابة الطالب: ${studentAns}

أعطِ درجة رقمية بين 0 و ${q.points} (يُسمح بالكسور)، وتغذية راجعة قصيرة بالعربية.
أعِد الرد بصيغة JSON فقط: {"score": number, "feedback": "..."}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) throw new Error(`فشل الاتصال بالذكاء الاصطناعي (${resp.status})`);
    const j = await resp.json();
    let parsed: any = {};
    try { parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}"); } catch { /* ignore */ }
    const score = Math.max(0, Math.min(Number(q.points), Number(parsed.score) || 0));
    const feedback = String(parsed.feedback ?? "");

    await supabaseAdmin.from("attempt_answers").update({
      ai_suggested_points: score, ai_feedback: feedback,
    }).eq("attempt_id", data.attempt_id).eq("question_id", data.question_id);

    return { score, feedback };
  });

export const saveReviewMarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    attempt_id: z.string().uuid(),
    marks: z.array(z.string()),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("exam_attempts").update({ review_marks: data.marks }).eq("id", data.attempt_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendWhatsAppLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ student_id: z.string().uuid(), exam_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await logActivity(supabaseAdmin, context.userId, "send_whatsapp_result", "student", data.student_id, { exam_id: data.exam_id });
    return { ok: true };
  });
