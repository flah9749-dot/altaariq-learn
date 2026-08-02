import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ingestDocument } from "@/lib/ai/kb-ingest.server";
import { searchKnowledge } from "@/lib/ai/kb-search.server";
import { callAI, type AiMessage } from "@/lib/ai/router.server";

const DOC_TYPES = ["book", "notes", "question_bank", "revision", "exam", "answer"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("غير مصرح");
}

const OCR_PROMPT =
  "استخرج كل النص العربي والإنجليزي الظاهر في هذه الصور بدقة وبالترتيب، مع الحفاظ على العناوين والفقرات والأسئلة. " +
  "لا تلخّص ولا تشرح. أعد النص فقط، وافصل بين كل صفحة والتالية بسطر: ===PAGE===";

/** OCR for scanned pages / images uploaded to the knowledge base. */
export const ocrKbPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      images: z.array(z.object({ page: z.number().int(), dataUrl: z.string().min(20) })).min(1).max(4),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const parts: Array<Record<string, unknown>> = [{ type: "text", text: OCR_PROMPT }];
    for (const img of data.images) parts.push({ type: "image_url", image_url: { url: img.dataUrl } });

    const msgs: AiMessage[] = [
      { role: "system", content: "أنت محرك OCR دقيق للغة العربية. أعد النص الخام فقط." },
      { role: "user", content: parts },
    ];

    const res = await callAI("map_analysis", msgs, {
      userId: context.userId,
      role: "admin",
      systemCall: true,
      maxTokens: 6000,
    });

    const blocks = res.text.split(/={2,}\s*PAGE\s*={2,}/i).map((s) => s.trim());
    return {
      pages: data.images.map((img, i) => ({ page: img.page, text: blocks[i] ?? (i === 0 ? res.text : "") })),
    };
  });


export const listKbDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("kb_documents")
      .select("id, title, doc_type, status, error, chunk_count, page_count, char_count, class_id, subject, term, created_at, classes(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { documents: data ?? [] };
  });

const CreateInput = z.object({
  title: z.string().min(1),
  docType: z.enum(DOC_TYPES),
  classId: z.string().uuid().nullable(),
  term: z.string().nullable().default(null),
  mimeType: z.string().nullable().default(null),
  pages: z.array(z.object({ page: z.number().int(), text: z.string() })).min(1),
});

/** Create the document row and index its extracted pages in one call. */
export const ingestKbDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: doc, error } = await context.supabase
      .from("kb_documents")
      .insert({
        title: data.title,
        doc_type: data.docType,
        class_id: data.classId,
        term: data.term,
        mime_type: data.mimeType,
        status: "processing",
        created_by: context.userId,
      } as any)
      .select("id")
      .single();
    if (error || !doc) throw new Error(error?.message ?? "تعذّر إنشاء المستند");

    const result = await ingestDocument({
      documentId: (doc as any).id,
      classId: data.classId,
      docType: data.docType,
      pages: data.pages,
    });
    return { documentId: (doc as any).id, ...result };
  });

/** Re-index an existing document with freshly extracted pages. */
export const reindexKbDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      documentId: z.string().uuid(),
      pages: z.array(z.object({ page: z.number().int(), text: z.string() })).min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: doc } = await context.supabase
      .from("kb_documents")
      .select("id, class_id, doc_type")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc) throw new Error("المستند غير موجود");
    return ingestDocument({
      documentId: data.documentId,
      classId: (doc as any).class_id,
      docType: (doc as any).doc_type,
      pages: data.pages,
    });
  });

export const deleteKbDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("kb_documents").delete().eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateKbDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      documentId: z.string().uuid(),
      title: z.string().min(1).optional(),
      docType: z.enum(DOC_TYPES).optional(),
      classId: z.string().uuid().nullable().optional(),
      term: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.docType !== undefined) patch.doc_type = data.docType;
    if (data.classId !== undefined) patch.class_id = data.classId;
    if (data.term !== undefined) patch.term = data.term;
    const { error } = await context.supabase.from("kb_documents").update(patch as any).eq("id", data.documentId);
    if (error) throw new Error(error.message);
    if (data.classId !== undefined || data.docType !== undefined) {
      const chunkPatch: Record<string, unknown> = {};
      if (data.classId !== undefined) chunkPatch.class_id = data.classId;
      if (data.docType !== undefined) chunkPatch.doc_type = data.docType;
      await context.supabase.from("kb_chunks").update(chunkPatch as any).eq("document_id", data.documentId);

    }
    return { ok: true };
  });

/** Admin preview of retrieval quality. */
export const previewKbSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ question: z.string().min(2), classId: z.string().uuid().nullable().default(null) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const hits = await searchKnowledge({ question: data.question, classId: data.classId, limit: 8 });
    return { hits };
  });

export const kbStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [{ count: docs }, { count: chunks }] = await Promise.all([
      context.supabase.from("kb_documents").select("id", { count: "exact", head: true }),
      context.supabase.from("kb_chunks").select("id", { count: "exact", head: true }),
    ]);
    return { documents: docs ?? 0, chunks: chunks ?? 0 };
  });
