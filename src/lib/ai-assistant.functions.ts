import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableChat, parseJsonLoose, type ChatMessage } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `أنت "مساعد الطارق"، مساعد ذكي احترافي لمدرس الدراسات الاجتماعية (تاريخ/جغرافيا/مواطنة) داخل منصة الطارق التعليمية.
مهامك:
- الرد باللغة العربية الفصحى الواضحة.
- مساعدة المدرس في: تحضير الدروس، مراجعات سريعة، خطط شرح، تحليل نتائج الطلاب، صياغة رسائل واتساب لأولياء الأمور، توليد أفكار امتحانات وأنشطة تعليمية.
- استخدم البيانات المرفقة (إحصائيات، طلاب، امتحانات) عند توفرها، وإذا لم تتوفر فاطلبها بلطف.
- كن مختصرًا ومنظمًا (عناوين ونقاط) ومفيدًا عمليًا.`;

type ChatInput = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context?: string;
};

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ChatInput) => data)
  .handler(async ({ data }) => {
    const msgs: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
    if (data.context) msgs.push({ role: "system", content: `سياق إضافي:\n${data.context}` });
    for (const m of data.messages) msgs.push({ role: m.role, content: m.content });
    const reply = await callLovableChat(msgs, { temperature: 0.6, maxTokens: 1400 });
    return { reply };
  });

export const analyzeExamResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { examId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: exam } = await supabase
      .from("exams")
      .select("id, title, subject, total_marks")
      .eq("id", data.examId)
      .maybeSingle();
    if (!exam) throw new Error("الامتحان غير موجود");

    const { data: attempts } = await supabase
      .from("exam_attempts")
      .select("id, score, total, status, student_id, students(full_name)")
      .eq("exam_id", data.examId)
      .in("status", ["submitted", "graded"]);

    const rows = attempts ?? [];
    const scores = rows.map((r: any) => Number(r.score ?? 0));
    const totals = rows.map((r: any) => Number(r.total ?? exam.total_marks ?? 0));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxTotal = Math.max(...totals, exam.total_marks ?? 0, 1);
    const pct = (avg / maxTotal) * 100;

    const { data: answers } = await supabase
      .from("attempt_answers")
      .select("question_id, is_correct, questions(text)")
      .in("attempt_id", rows.map((r: any) => r.id));

    const perQ: Record<string, { text: string; correct: number; total: number }> = {};
    for (const a of answers ?? []) {
      const qid = (a as any).question_id;
      const text = ((a as any).questions?.text ?? "").slice(0, 100);
      perQ[qid] = perQ[qid] ?? { text, correct: 0, total: 0 };
      perQ[qid].total += 1;
      if ((a as any).is_correct) perQ[qid].correct += 1;
    }
    const hardest = Object.values(perQ)
      .filter((q) => q.total >= 2)
      .sort((a, b) => a.correct / a.total - b.correct / b.total)
      .slice(0, 5)
      .map((q) => `- ${q.text} (نسبة الصواب ${Math.round((q.correct / q.total) * 100)}%)`)
      .join("\n");

    const summary = `امتحان: ${exam.title}
عدد المحاولات: ${rows.length}
متوسط الدرجات: ${avg.toFixed(1)} / ${maxTotal} (${pct.toFixed(1)}%)
أصعب الأسئلة:
${hardest || "لا توجد بيانات كافية"}`;

    const reply = await callLovableChat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `حلّل نتائج هذا الامتحان وقدّم:
1) ملخص موجز للأداء العام
2) نقاط القوة والضعف
3) توصيات عملية للمدرس (شرح، تدريبات، أنشطة)
4) اقتراح رسالة قصيرة لأولياء الأمور

البيانات:
${summary}`,
        },
      ],
      { temperature: 0.5, maxTokens: 1200 },
    );

    return { insights: reply, avg, pct, attempts: rows.length };
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
        .join("\n") || "لا توجد محاولات";

    const summary = `الطالب: ${(student as any).full_name} (${(student as any).code})
الصف: ${(student as any).classes?.name ?? "-"} | المجموعة: ${(student as any).groups?.name ?? "-"}
النقاط: ${(student as any).points} | المستوى: ${(student as any).level}
آخر النتائج:
${lines}`;

    const reply = await callLovableChat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `قدّم تحليلًا شخصيًا لهذا الطالب:
1) تقييم الأداء العام
2) نقاط القوة والضعف
3) خطة تحسين خلال أسبوعين
4) رسالة تحفيزية قصيرة له
5) رسالة لولي الأمر

${summary}`,
        },
      ],
      { temperature: 0.6, maxTokens: 1200 },
    );

    return { insights: reply };
  });
