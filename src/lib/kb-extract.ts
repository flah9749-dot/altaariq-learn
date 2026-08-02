// Client-side text extraction for knowledge-base uploads.
// Runs in the browser: the server runtime is an edge Worker with no PDF binaries.
// Scanned PDFs and images fall back to AI OCR (pages are rendered to JPEG here
// and sent to the server in small batches).

export type PageText = { page: number; text: string };
export type PageImage = { page: number; dataUrl: string };
export type OcrFn = (images: PageImage[]) => Promise<PageText[]>;

/** Pages sent per OCR request. */
export const OCR_BATCH = 3;
/** Hard cap on OCR'd pages per document (cost guard). */
const OCR_MAX_PAGES = 120;

export async function extractPages(
  file: File,
  onProgress?: (p: number) => void,
  ocr?: OcrFn,
): Promise<PageText[]> {
  const name = file.name.toLowerCase();
  const mime = file.type;

  if (mime.startsWith("image/")) {
    if (!ocr) throw new Error("قراءة الصور تحتاج تفعيل الاستخراج الذكي");
    onProgress?.(20);
    const dataUrl = await imageFileToDataUrl(file);
    const pages = await runOcr([{ page: 1, dataUrl }], ocr, onProgress);
    if (!pages.some((p) => p.text.trim().length > 20)) {
      throw new Error("تعذّر قراءة نص من الصورة — جرّب صورة أوضح");
    }
    return pages;
  }

  if (mime === "application/pdf" || name.endsWith(".pdf")) return extractPdf(file, onProgress, ocr);
  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) return extractDocx(file);
  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
    const text = await file.text();
    onProgress?.(100);
    return splitPlainText(text);
  }
  throw new Error("صيغة غير مدعومة للفهرسة — استخدم PDF أو Word أو صورة أو ملف نصي");
}

async function extractPdf(file: File, onProgress?: (p: number) => void, ocr?: OcrFn): Promise<PageText[]> {
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
    onProgress?.(Math.round((i / doc.numPages) * 40));
  }

  const total = pages.reduce((a, p) => a + p.text.replace(/\s/g, "").length, 0);
  const avg = total / Math.max(1, pages.length);
  if (avg >= 120) return pages;

  // Scanned / image-only PDF → OCR the pages that have (almost) no text.
  if (!ocr) throw new Error("الملف صور ممسوحة بدون نص — حوّله لنص أولاً أو ارفع نسخة نصية");

  const targets = pages
    .filter((p) => p.text.replace(/\s/g, "").length < 120)
    .slice(0, OCR_MAX_PAGES)
    .map((p) => p.page);

  const images: PageImage[] = [];
  for (const num of targets) {
    const page = await doc.getPage(num);
    images.push({ page: num, dataUrl: await renderPageToJpeg(page) });
  }

  const ocrPages = await runOcr(images, ocr, (p) => onProgress?.(40 + Math.round(p * 0.6)));
  const byPage = new Map(ocrPages.map((p) => [p.page, p.text]));
  const merged = pages.map((p) => {
    const t = byPage.get(p.page);
    return t && t.trim().length > p.text.trim().length ? { page: p.page, text: t } : p;
  });

  const after = merged.reduce((a, p) => a + p.text.replace(/\s/g, "").length, 0);
  if (after < 80) throw new Error("تعذّر استخراج نص من الملف — جرّب نسخة أوضح");
  return merged;
}

async function renderPageToJpeg(page: any, maxWidth = 1400): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, Math.max(1, maxWidth / base.width));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/jpeg", 0.75);
}

async function runOcr(images: PageImage[], ocr: OcrFn, onProgress?: (p: number) => void): Promise<PageText[]> {
  const out: PageText[] = [];
  for (let i = 0; i < images.length; i += OCR_BATCH) {
    const slice = images.slice(i, i + OCR_BATCH);
    const res = await ocr(slice);
    out.push(...res);
    onProgress?.(Math.round(((i + slice.length) / images.length) * 100));
  }
  return out;
}

/** Downscale an uploaded image so the OCR payload stays small. */
async function imageFileToDataUrl(file: File, maxWidth = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

async function extractDocx(file: File): Promise<PageText[]> {
  const mammoth: any = await import(/* @vite-ignore */ "mammoth/mammoth.browser" as string);
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
