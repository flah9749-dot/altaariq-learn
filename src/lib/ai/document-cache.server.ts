// Store extracted text of uploaded files once, keyed by SHA256 of the file bytes.
// After the first upload the router forwards the compact text to the model
// instead of the full base64 payload — huge token savings on repeat questions
// about the same file.

import { sha256Hex } from "./hash.server";

function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

export async function hashDataUrl(dataUrl: string): Promise<string | null> {
  const parsed = decodeDataUrl(dataUrl);
  if (!parsed) return null;
  const buf = await crypto.subtle.digest("SHA-256", parsed.bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function lookupDocumentByHash(hash: string): Promise<{ text: string; charCount: number } | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_extracted_documents")
      .select("extracted_text, char_count")
      .eq("source_hash", hash)
      .maybeSingle();
    if (!data?.extracted_text) return null;

    supabaseAdmin
      .from("ai_extracted_documents")
      .update({ last_used_at: new Date().toISOString() })
      .eq("source_hash", hash)
      .then(() => {}, () => {});

    return { text: data.extracted_text as string, charCount: (data.char_count as number) ?? (data.extracted_text as string).length };
  } catch {
    return null;
  }
}

export async function saveExtractedDocument(opts: {
  hash: string;
  fileName?: string;
  mimeType?: string;
  text: string;
  pageCount?: number;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_extracted_documents").upsert({
      source_hash: opts.hash,
      file_name: opts.fileName ?? null,
      mime_type: opts.mimeType ?? null,
      extracted_text: opts.text,
      page_count: opts.pageCount ?? null,
      char_count: opts.text.length,
    }, { onConflict: "source_hash" });
  } catch {}
}

/** Truncate long extracted text to a safe token budget (~4 chars/token). */
export function clampText(text: string, maxChars = 32_000): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.7));
  const tail = text.slice(-Math.floor(maxChars * 0.25));
  return `${head}\n\n[... تم اختصار جزء من المستند ...]\n\n${tail}`;
}

export const documentCache = {
  hashDataUrl,
  lookupDocumentByHash,
  saveExtractedDocument,
  clampText,
};
