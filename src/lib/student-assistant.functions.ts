import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI, type AiMessage } from "@/lib/ai/router.server";
import { trimHistory } from "@/lib/ai/context-manager.server";
import { hashDataUrl, lookupDocumentByHash, saveExtractedDocument, clampText } from "@/lib/ai/document-cache.server";

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

const SYSTEM_PROMPT =
  "أنت مساعد الطلاب في منصة الطارق (دراسات اجتماعية). اشرح بالعربية البسيطة بعناوين ونقاط. لو رُفع ملف اقرأه واستخرج المفاهيم. لا تعطِ إجابات امتحان مباشرة. لا تعتذر عن قراءة الملفات.";

export const askStudentAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const history = data.messages.slice(0, -1);
    const last = data.messages[data.messages.length - 1];

    // Build the multimodal parts for the last message, reusing extracted text when possible.
    const parts: Array<Record<string, unknown>> = [{ type: "text", text: last?.content ?? "" }];
    for (const att of data.attachments) {
      const hash = await hashDataUrl(att.data_url);
      if (hash) {
        const cached = await lookupDocumentByHash(hash);
        if (cached) {
          parts.push({ type: "text", text: `[محتوى الملف "${att.name}"]\n${clampText(cached.text)}` });
          continue;
        }
      }
      if (att.kind === "image") {
        parts.push({ type: "image_url", image_url: { url: att.data_url } });
      } else {
        parts.push({ type: "file", file: { filename: att.name, file_data: att.data_url } });
      }
    }

    const raw: AiMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
    for (const m of history) raw.push({ role: m.role, content: m.content });
    raw.push({ role: "user", content: parts });

    // Trim history: keep last N, drop older to save tokens.
    const flat = raw.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : "[محتوى مرفق]",
    }));
    const trim = trimHistory(flat as any);
    const keepIdx = new Set(trim.trimmed.map((_, i) => i));
    const msgs = raw.filter((_, i) => keepIdx.has(i));

    const hasAttachment = data.attachments.length > 0;
    const taskType = hasAttachment ? "student_assistant_file" : "student_assistant_chat";

    const result = await callAI(taskType as any, msgs, {
      userId: context.userId,
      role: "student",
    });

    // Persist extracted text on first upload.
    for (const att of data.attachments) {
      const hash = await hashDataUrl(att.data_url);
      if (!hash) continue;
      const existing = await lookupDocumentByHash(hash);
      if (existing) continue;
      await saveExtractedDocument({
        hash,
        fileName: att.name,
        mimeType: att.kind === "image" ? "image/*" : "application/pdf",
        text: result.text.slice(0, 60_000),
      });
    }

    return { reply: result.text, cached: result.cached };
  });
