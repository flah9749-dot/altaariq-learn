// Ingest pipeline: extracted page texts → chunks → embeddings → kb_chunks rows.
// Text extraction happens client-side (pdfjs / mammoth / plain text) because the
// server runtime is an edge Worker without native PDF binaries.

import { chunkDocument, estimateTokens, type DocType, type PageText } from "./kb-chunker.server";
import { embedMany } from "./embeddings.server";

const EMBED_BATCH = 32;

export type IngestResult = { chunks: number; chars: number; pages: number };

export async function ingestDocument(opts: {
  documentId: string;
  classId: string | null;
  docType: DocType;
  pages: PageText[];
}): Promise<IngestResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin.from("kb_documents").update({ status: "processing", error: null }).eq("id", opts.documentId);

  try {
    const chunks = chunkDocument(opts.pages, opts.docType);
    if (!chunks.length) throw new Error("لم يُعثر على نص قابل للفهرسة في الملف");

    // Replace any previous indexing for this document.
    await supabaseAdmin.from("kb_chunks").delete().eq("document_id", opts.documentId);

    let inserted = 0;
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const slice = chunks.slice(i, i + EMBED_BATCH);
      const vectors = await embedMany(slice.map((c) => c.content));
      const rows = slice.map((c, j) => ({
        document_id: opts.documentId,
        class_id: opts.classId,
        doc_type: opts.docType,
        unit: c.unit,
        lesson: c.lesson,
        heading: c.heading,
        page_number: c.pageNumber,
        chunk_index: i + j,
        content: c.content,
        token_estimate: estimateTokens(c.content),
        embedding: JSON.stringify(vectors[j]),
      }));
      const { error } = await supabaseAdmin.from("kb_chunks").insert(rows as any);
      if (error) throw new Error(error.message);
      inserted += rows.length;
    }

    const chars = opts.pages.reduce((a, p) => a + (p.text?.length ?? 0), 0);
    await supabaseAdmin.from("kb_documents").update({
      status: "ready",
      error: null,
      chunk_count: inserted,
      page_count: opts.pages.length,
      char_count: chars,
    }).eq("id", opts.documentId);

    return { chunks: inserted, chars, pages: opts.pages.length };
  } catch (e: any) {
    const message = String(e?.message ?? e).slice(0, 400);
    await supabaseAdmin.from("kb_documents").update({ status: "failed", error: message }).eq("id", opts.documentId);
    throw new Error(message);
  }
}

/** Index a single free-form snippet (used by "اسأل المدرس" answers). */
export async function ingestSnippet(opts: {
  title: string;
  classId: string | null;
  content: string;
  docType?: DocType;
  heading?: string | null;
}): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: doc, error } = await supabaseAdmin
    .from("kb_documents")
    .insert({
      title: opts.title,
      doc_type: opts.docType ?? "answer",
      class_id: opts.classId,
      status: "processing",
    } as any)
    .select("id")
    .single();
  if (error || !doc) throw new Error(error?.message ?? "تعذّر إنشاء المستند");

  await ingestDocument({
    documentId: (doc as any).id,
    classId: opts.classId,
    docType: opts.docType ?? "answer",
    pages: [{ page: 1, text: `${opts.heading ?? opts.title}\n${opts.content}` }],
  });
  return (doc as any).id;
}
