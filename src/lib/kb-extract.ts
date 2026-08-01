// Client-side text extraction for knowledge-base uploads.
// Runs in the browser: the server runtime is an edge Worker with no PDF binaries.

export type PageText = { page: number; text: string };

export async function extractPages(file: File, onProgress?: (p: number) => void): Promise<PageText[]> {
  const name = file.name.toLowerCase();
  const mime = file.type;

  if (mime === "application/pdf" || name.endsWith(".pdf")) return extractPdf(file, onProgress);
  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) return extractDocx(file);
  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
    const text = await file.text();
    onProgress?.(100);
    return splitPlainText(text);
  }
  throw new Error("صيغة غير مدعومة للفهرسة — استخدم PDF أو Word أو ملف نصي");
}

async function extractPdf(file: File, onProgress?: (p: number) => void): Promise<PageText[]> {
  const pdfjs: any = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: PageText[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let current = "";
    let lastY: number | null = null;

    for (const item of content.items as any[]) {
      const str = item.str ?? "";
      const y = Math.round(item.transform?.[5] ?? 0);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (current.trim()) lines.push(current.trim());
        current = "";
      }
      current += str + (item.hasEOL ? "\n" : " ");
      lastY = y;
    }
    if (current.trim()) lines.push(current.trim());

    pages.push({ page: i, text: lines.join("\n") });
    onProgress?.(Math.round((i / doc.numPages) * 100));
  }

  const total = pages.reduce((a, p) => a + p.text.replace(/\s/g, "").length, 0);
  if (total < 50) throw new Error("الملف صور ممسوحة بدون نص — حوّله لنص أولاً أو ارفع نسخة نصية");
  return pages;
}

async function extractDocx(file: File): Promise<PageText[]> {
  const mammoth: any = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  if (!value?.trim()) throw new Error("لم يُعثر على نص داخل الملف");
  return splitPlainText(value);
}

/** Plain text is split into ~4000-char virtual pages so page refs stay useful. */
function splitPlainText(text: string): PageText[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const size = 4000;
  const pages: PageText[] = [];
  for (let i = 0, p = 1; i < clean.length; i += size, p++) {
    pages.push({ page: p, text: clean.slice(i, i + size) });
  }
  return pages.length ? pages : [{ page: 1, text: clean }];
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  book: "كتاب الوزارة",
  notes: "مذكرة",
  question_bank: "بنك أسئلة",
  revision: "مراجعة",
  exam: "امتحان سابق",
  answer: "إجابة المدرس",
};
