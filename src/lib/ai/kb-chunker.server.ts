// Document-type aware chunking for the knowledge base.
// Each document type is split differently so retrieval returns focused context.

export type DocType = "book" | "notes" | "question_bank" | "revision" | "exam" | "answer";

export type RawChunk = {
  unit: string | null;
  lesson: string | null;
  heading: string | null;
  pageNumber: number | null;
  content: string;
};

export type PageText = { page: number; text: string };

const UNIT_RE = /^\s*(?:الوحدة|الوحده|الباب)\s*[:\-–]?\s*(.{0,80})$/;
const LESSON_RE = /^\s*(?:الدرس|الموضوع|الفصل)\s*[:\-–]?\s*(.{0,80})$/;
const QUESTION_RE = /^\s*(?:س\s*\d+|السؤال\s*(?:\d+|الأول|الثاني|الثالث)|\d+\s*[-.)])\s*/;

const TARGET_CHARS = 1200;
const MAX_CHARS = 1800;
const OVERLAP_CHARS = 150;

/** Split extracted page texts into chunks according to the document type. */
export function chunkDocument(pages: PageText[], docType: DocType): RawChunk[] {
  const clean = pages
    .map((p) => ({ page: p.page, text: (p.text ?? "").replace(/\u0000/g, "").trim() }))
    .filter((p) => p.text.length > 0);
  if (!clean.length) return [];

  switch (docType) {
    case "question_bank":
    case "exam":
      return chunkByQuestions(clean);
    case "revision":
    case "notes":
      return chunkByHeadings(clean);
    case "book":
    default:
      return chunkByUnitsAndLessons(clean);
  }
}

/** الكتاب المدرسي: وحدة ← درس ← فقرات. */
function chunkByUnitsAndLessons(pages: PageText[]): RawChunk[] {
  const out: RawChunk[] = [];
  let unit: string | null = null;
  let lesson: string | null = null;

  for (const page of pages) {
    let buffer: string[] = [];
    const flush = () => {
      const text = buffer.join("\n").trim();
      buffer = [];
      if (text.length < 40) return;
      for (const piece of splitLong(text)) {
        out.push({ unit, lesson, heading: lesson ?? unit, pageNumber: page.page, content: piece });
      }
    };

    for (const line of page.text.split(/\r?\n/)) {
      const u = line.match(UNIT_RE);
      if (u) { flush(); unit = trimTitle(line); lesson = null; continue; }
      const l = line.match(LESSON_RE);
      if (l) { flush(); lesson = trimTitle(line); continue; }
      buffer.push(line);
      if (buffer.join("\n").length >= MAX_CHARS) flush();
    }
    flush();
  }
  return out;
}

/** مذكرة / مراجعة: تقسيم على العناوين القصيرة. */
function chunkByHeadings(pages: PageText[]): RawChunk[] {
  const out: RawChunk[] = [];
  let heading: string | null = null;

  for (const page of pages) {
    let buffer: string[] = [];
    const flush = () => {
      const text = buffer.join("\n").trim();
      buffer = [];
      if (text.length < 40) return;
      for (const piece of splitLong(text)) {
        out.push({ unit: null, lesson: heading, heading, pageNumber: page.page, content: piece });
      }
    };

    for (const line of page.text.split(/\r?\n/)) {
      if (isHeading(line)) { flush(); heading = trimTitle(line); continue; }
      buffer.push(line);
      if (buffer.join("\n").length >= MAX_CHARS) flush();
    }
    flush();
  }
  return out;
}

/** بنك أسئلة / امتحان: مقطع لكل سؤال. */
function chunkByQuestions(pages: PageText[]): RawChunk[] {
  const out: RawChunk[] = [];
  for (const page of pages) {
    let buffer: string[] = [];
    const flush = () => {
      const text = buffer.join("\n").trim();
      buffer = [];
      if (text.length < 15) return;
      out.push({ unit: null, lesson: null, heading: firstLine(text), pageNumber: page.page, content: text.slice(0, MAX_CHARS) });
    };

    for (const line of page.text.split(/\r?\n/)) {
      if (QUESTION_RE.test(line) && buffer.length) flush();
      buffer.push(line);
      if (buffer.join("\n").length >= MAX_CHARS) flush();
    }
    flush();
  }
  return out;
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const parts: string[] = [];
  const sentences = text.split(/(?<=[.؟!\n])\s+/);
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).length > TARGET_CHARS && cur) {
      parts.push(cur.trim());
      cur = cur.slice(Math.max(0, cur.length - OVERLAP_CHARS)) + " " + s;
    } else {
      cur += (cur ? " " : "") + s;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.filter((p) => p.length >= 40);
}

function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 70) return false;
  if (/[.؟!]$/.test(t)) return false;
  return /^(?:[•\-–*]|\d+[-.)]|أولاً|ثانياً|ثالثاً|رابعاً|مفهوم|تعريف|أسباب|نتائج|خصائص|أهمية|مقارنة|ملخص)/.test(t)
    || t.split(/\s+/).length <= 6;
}

function trimTitle(line: string): string {
  return line.replace(/\s+/g, " ").trim().slice(0, 120);
}

function firstLine(text: string): string {
  return text.split(/\r?\n/)[0]?.slice(0, 120) ?? "";
}

export function estimateTokens(text: string): number {
  // Arabic averages ~2.5 chars/token on modern tokenizers.
  return Math.ceil(text.length / 2.5);
}
