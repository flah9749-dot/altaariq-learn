import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
  attachments: z.array(z.object({
    kind: z.enum(["image", "pdf"]),
    name: z.string(),
    data_url: z.string(),
  })).default([]),
});

const SYSTEM_PROMPT = `أنت "مساعد الطارق للطلاب"، معلّم ذكي ودود لمادة الدراسات الاجتماعية (تاريخ/جغرافيا/مواطنة) في منصة الطارق التعليمية.
مهامك:
- شرح الدروس والمفاهيم بلغة عربية بسيطة ومناسبة لعمر الطالب.
- إذا رفع الطالب ملفًا (PDF/صورة): استخرج محتواه ولخّصه في نقاط مرتّبة، ثم اشرح المفاهيم الصعبة، واقترح أسئلة مراجعة.
- استخدم عناوين ونقاط وأمثلة قريبة من بيئة الطالب.
- شجّع الطالب وحفّزه، ولا تعطه إجابات امتحان مباشرة إن كان يحاول الغش.
- كن مختصرًا ومنظمًا ومفيدًا.`;

export const askStudentAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const { callLovableChat } = await import("./ai-gateway.server");

    const history = data.messages.slice(0, -1);
    const last = data.messages[data.messages.length - 1];

    const parts: Array<Record<string, unknown>> = [{ type: "text", text: last?.content ?? "" }];
    for (const att of data.attachments) {
      if (att.kind === "image") {
        parts.push({ type: "image_url", image_url: { url: att.data_url } });
      } else {
        parts.push({ type: "file", file: { filename: att.name, file_data: att.data_url } });
      }
    }

    const msgs: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
    for (const m of history) msgs.push({ role: m.role, content: m.content });
    msgs.push({ role: "user", content: parts });

    const reply = await callLovableChat(msgs, { temperature: 0.6, maxTokens: 1600 });

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ai_usage_logs").insert({ function_name: "student_assistant", success: true });
    } catch {}

    return { reply };
  });
