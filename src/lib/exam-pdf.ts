// Print-ready paper exam PDF export (Arabic RTL).
// Renders questions as HTML, rasterises with html2canvas-pro, then slices into A4 pages.

import { QUESTION_TYPES } from "./exam-utils";

const typeLabel = (t: string) => QUESTION_TYPES.find((x) => x.value === t)?.label ?? t;

function escapeHtml(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

type PaperQuestion = {
  type: string;
  text: string;
  points?: number | null;
  image_url?: string | null;
  correct_answer?: any;
  options?: Array<{ text: string; is_correct?: boolean; match_key?: string | null }>;
  explanation?: string | null;
  difficulty?: string | null;
};

export type ExamPdfOptions = {
  title: string;
  subtitle?: string;
  questions: PaperQuestion[];
  showAnswers?: boolean;   // true = teacher answer key, false = student paper
  showPoints?: boolean;
  filename?: string;
};

function renderMcq(q: PaperQuestion, showAnswers: boolean) {
  const letters = ["أ", "ب", "ج", "د", "هـ", "و"];
  const items = (q.options ?? []).map((o, i) => {
    const mark = showAnswers && o.is_correct ? "background:#dcfce7;border-color:#16a34a;" : "";
    return `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 10px;margin:4px 0;border:1px solid #cbd5e1;border-radius:8px;${mark}">
      <span style="display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;border-radius:50%;background:#f1f5f9;font-weight:700;color:#0f172a;">${letters[i] ?? i + 1}</span>
      <span style="flex:1;">${escapeHtml(o.text)}${showAnswers && o.is_correct ? ' <span style="color:#16a34a;font-weight:700;">(الإجابة الصحيحة)</span>' : ""}</span>
    </div>`;
  }).join("");
  return `<div>${items}</div>`;
}

function renderTrueFalse(q: PaperQuestion, showAnswers: boolean) {
  const correct = String(q.correct_answer ?? "").toLowerCase();
  const isTrue = correct === "true" || correct === "صح" || correct === "1";
  const boxT = showAnswers && isTrue ? "background:#dcfce7;border-color:#16a34a;" : "";
  const boxF = showAnswers && !isTrue ? "background:#dcfce7;border-color:#16a34a;" : "";
  return `<div style="display:flex;gap:12px;">
    <div style="padding:8px 20px;border:1px solid #cbd5e1;border-radius:8px;${boxT}">☐ صح</div>
    <div style="padding:8px 20px;border:1px solid #cbd5e1;border-radius:8px;${boxF}">☐ خطأ</div>
    ${showAnswers ? `<div style="align-self:center;color:#16a34a;font-weight:700;">الإجابة: ${isTrue ? "صح" : "خطأ"}</div>` : ""}
  </div>`;
}

function renderComplete(q: PaperQuestion, showAnswers: boolean) {
  return `<div style="border-bottom:2px dashed #64748b;min-height:34px;margin-top:8px;">${
    showAnswers ? `<span style="color:#16a34a;font-weight:700;">${escapeHtml(q.correct_answer)}</span>` : ""
  }</div>`;
}

function renderEssay(_q: PaperQuestion) {
  return `<div style="margin-top:8px;">${Array.from({ length: 5 }).map(() =>
    `<div style="border-bottom:1px solid #cbd5e1;height:26px;"></div>`).join("")}</div>`;
}

function renderOrder(q: PaperQuestion, showAnswers: boolean) {
  const items = (q.options ?? []).map((o, i) =>
    `<li style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:8px;margin:4px 0;list-style:none;display:flex;gap:8px;align-items:center;">
      <span style="display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;border-radius:6px;background:#f1f5f9;font-weight:700;">${i + 1}</span>
      <span>${escapeHtml(o.text)}</span>
    </li>`).join("");
  const answer = showAnswers && Array.isArray(q.correct_answer)
    ? `<div style="margin-top:6px;color:#16a34a;font-weight:700;">الترتيب الصحيح: ${q.correct_answer.map((x: any) => escapeHtml(x)).join(" ← ")}</div>`
    : "";
  return `<div>${items}${answer}<div style="color:#64748b;font-size:11px;margin-top:6px;">رتّب العناصر بالتسلسل الصحيح.</div></div>`;
}

function renderMatch(q: PaperQuestion, showAnswers: boolean) {
  const rows = (q.options ?? []).map((o) =>
    `<tr>
      <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:600;width:40%;">${escapeHtml(o.match_key)}</td>
      <td style="padding:8px 10px;border:1px solid #cbd5e1;">${showAnswers ? escapeHtml(o.text) : "&nbsp;"}</td>
    </tr>`).join("");
  const bank = !showAnswers
    ? `<div style="margin-top:8px;padding:8px;border:1px dashed #94a3b8;border-radius:8px;">
        <b>بنك الإجابات:</b> ${(q.options ?? []).map((o) => escapeHtml(o.text)).sort().join(" • ")}
      </div>` : "";
  return `<div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="padding:8px;background:#1e293b;color:#fff;border:1px solid #1e293b;text-align:right;">العمود الأول</th>
        <th style="padding:8px;background:#1e293b;color:#fff;border:1px solid #1e293b;text-align:right;">التوصيل</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>${bank}
  </div>`;
}

function renderMap(q: PaperQuestion, showAnswers: boolean) {
  const points = Array.isArray(q.correct_answer?.points) ? q.correct_answer.points : [];
  const img = q.image_url
    ? `<div style="position:relative;display:inline-block;max-width:100%;">
        <img src="${q.image_url}" style="max-width:100%;max-height:340px;border:1px solid #cbd5e1;border-radius:8px;" crossorigin="anonymous" />
        ${points.map((p: any, i: number) =>
          `<span style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);background:#0f172a;color:#fff;width:22px;height:22px;line-height:20px;border-radius:999px;font-size:12px;font-weight:700;text-align:center;border:2px solid #fff;box-shadow:0 0 0 1px #0f172a;">${i + 1}</span>`
        ).join("")}
      </div>`
    : `<div style="padding:16px;border:1px dashed #94a3b8;border-radius:8px;color:#64748b;">(لم تُرفق صورة الخريطة)</div>`;

  const renderSub = (sq: any, si: number): string => {
    const t = escapeHtml(sq.text || "");
    const header = `<div style="font-size:12px;color:#334155;margin-bottom:2px;"><b>س${si + 1}${sq.points ? ` (${sq.points} د)` : ""}:</b> ${t}</div>`;
    if (showAnswers) {
      let ans = "";
      if (sq.type === "mcq") {
        const c = (sq.options ?? []).find((o: any) => o.is_correct);
        ans = c ? `<b style="color:#16a34a;">${escapeHtml(c.text)}</b>` : "";
      } else if (sq.type === "true_false") ans = `<b style="color:#16a34a;">${sq.answer === "false" ? "خطأ" : "صح"}</b>`;
      else if (sq.type === "essay") ans = `<span style="color:#64748b;">(يُصحح يدويًا)</span>`;
      else ans = `<b style="color:#16a34a;">${escapeHtml(sq.answer ?? "")}</b>`;
      return `<div style="margin:4px 0;padding:4px 6px;border-right:2px solid #cbd5e1;">${header}<div>${ans}</div></div>`;
    }
    let body = "";
    if (sq.type === "mcq") body = (sq.options ?? []).map((o: any) => `<div>☐ ${escapeHtml(o.text)}</div>`).join("");
    else if (sq.type === "true_false") body = `☐ صح &nbsp;&nbsp; ☐ خطأ`;
    else if (sq.type === "essay") body = Array.from({ length: 3 }).map(() => `<div style="border-bottom:1px solid #cbd5e1;height:22px;"></div>`).join("");
    else body = `<div style="border-bottom:1px dashed #94a3b8;min-height:22px;"></div>`;
    return `<div style="margin:4px 0;padding:4px 6px;border-right:2px solid #cbd5e1;">${header}<div>${body}</div></div>`;
  };

  const list = points.length
    ? `<ol style="margin-top:8px;padding-inline-start:20px;">
        ${points.map((p: any, i: number) => {
          const subs = Array.isArray(p?.questions) ? p.questions : [];
          if (subs.length === 0) {
            const prompt = typeof p?.prompt === "string" && p.prompt.trim() ? escapeHtml(p.prompt) : "";
            const promptHtml = prompt ? `<span style="color:#0f172a;">${prompt}</span> — ` : "";
            const answerHtml = showAnswers
              ? `<b style="color:#16a34a;">${escapeHtml(p.label)}</b>`
              : `<span style="display:inline-block;border-bottom:1px dashed #94a3b8;min-width:180px;">&nbsp;</span>`;
            return `<li style="margin-bottom:6px;">${promptHtml}${answerHtml}</li>`;
          }
          const head = escapeHtml(p.prompt || p.label || `الموقع ${i + 1}`);
          return `<li style="margin-bottom:10px;">
            <div style="font-weight:600;">${head}</div>
            ${subs.map((sq: any, si: number) => renderSub(sq, si)).join("")}
          </li>`;
        }).join("")}
      </ol>`
    : "";
  const hint = !showAnswers ? `<div style="margin-top:4px;color:#64748b;font-size:11px;">أجب على كل رقم موجود على الخريطة.</div>` : "";
  return `<div>${img}${list}${hint}</div>`;
}

function renderQuestionBody(q: PaperQuestion, showAnswers: boolean) {
  switch (q.type) {
    case "mcq": return renderMcq(q, showAnswers);
    case "true_false": return renderTrueFalse(q, showAnswers);
    case "complete": return renderComplete(q, showAnswers);
    case "essay": return renderEssay(q);
    case "order": return renderOrder(q, showAnswers);
    case "match": return renderMatch(q, showAnswers);
    case "map": return renderMap(q, showAnswers);
    default: return `<div style="color:#64748b;">— نوع سؤال غير معروف —</div>`;
  }
}

/** Rasterize a single HTML fragment (offscreen) into a canvas. */
async function rasterizeFragment(html: string, widthPx: number): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const el = document.createElement("div");
  el.setAttribute("dir", "rtl");
  el.setAttribute("lang", "ar");
  el.style.cssText = [
    "position:fixed",
    "top:-10000px",
    "right:0",
    `width:${widthPx}px`,
    "padding:0",
    "background:#ffffff",
    "color:#0f172a",
    'font-family:"Cairo","Tajawal","Segoe UI",Arial,sans-serif',
    "font-size:14px",
    "line-height:1.9",
    "box-sizing:border-box",
  ].join(";");
  el.innerHTML = html;
  document.body.appendChild(el);
  try {
    if ((document as any).fonts?.ready) { try { await (document as any).fonts.ready; } catch {} }
    const imgs = Array.from(el.querySelectorAll("img"));
    await Promise.all(imgs.map((img) => new Promise<void>((res) => {
      if ((img as HTMLImageElement).complete) return res();
      img.addEventListener("load", () => res(), { once: true });
      img.addEventListener("error", () => res(), { once: true });
      setTimeout(() => res(), 4000);
    })));
    await new Promise((r) => setTimeout(r, 40));
    return await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
  } finally {
    el.remove();
  }
}

export async function exportExamToPdf(opts: ExamPdfOptions) {
  const { default: jsPDF } = await import("jspdf");
  const showAnswers = !!opts.showAnswers;
  const showPoints = opts.showPoints !== false;
  const total = opts.questions.reduce((a, q) => a + (Number(q.points) || 0), 0);

  // Preload Arabic fonts to avoid ligature/shaping breakage in html2canvas
  // (e.g. "منصة الطارق" appearing mangled when the fallback font lacks glyphs).
  if (!document.getElementById("__exam_pdf_fonts")) {
    const link = document.createElement("link");
    link.id = "__exam_pdf_fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;700&display=swap";
    document.head.appendChild(link);
    // Give the browser a beat to fetch the font files
    await new Promise((r) => setTimeout(r, 400));
    if ((document as any).fonts?.ready) { try { await (document as any).fonts.ready; } catch {} }
  }

  const headerHtml = `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:12px;color:#fff;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:56px;height:56px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid #b58900;flex-shrink:0;">
            <img src="/icon-192.png" alt="شعار المنصة" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <div>
            <div style="font-size:20px;font-weight:800;color:#f5deb3;">منصة الطارق التعليمية</div>
            <div style="font-size:12px;color:#cbd5e1;margin-top:2px;">الدراسات الاجتماعية — تاريخ · جغرافيا · مواطنة</div>
          </div>
        </div>
        <div style="text-align:left;font-size:11px;color:#e2e8f0;line-height:1.6;">
          <div>📅 ${new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</div>
          ${showAnswers ? `<div style="margin-top:4px;padding:3px 10px;background:#dc2626;color:#fff;border-radius:999px;font-weight:800;font-size:11px;text-align:center;">نموذج الإجابة</div>` : `<div style="margin-top:4px;padding:3px 10px;background:#b58900;color:#0f172a;border-radius:999px;font-weight:800;font-size:11px;text-align:center;">ورقة الامتحان</div>`}
        </div>
      </div>

      <div style="margin-top:14px;padding:12px 16px;background:#fbfaf6;border:1px solid #e2e8f0;border-right:4px solid #b58900;border-radius:10px;">
        <h1 style="font-size:20px;font-weight:800;margin:0 0 4px;color:#0f172a;">${escapeHtml(opts.title)}</h1>
        ${opts.subtitle ? `<div style="font-size:13px;color:#475569;margin-bottom:6px;">${escapeHtml(opts.subtitle)}</div>` : ""}
        <div style="display:flex;gap:16px;font-size:12px;color:#334155;margin-top:6px;flex-wrap:wrap;">
          <div>📝 عدد الأسئلة: <b style="color:#0f172a;">${opts.questions.length}</b></div>
          ${showPoints ? `<div>⭐ الدرجة الكلية: <b style="color:#b58900;">${total}</b></div>` : ""}
        </div>
      </div>

      ${!showAnswers ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;font-size:13px;">
        <div style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;">الاسم: <span style="display:inline-block;border-bottom:1px solid #94a3b8;min-width:180px;">&nbsp;</span></div>
        <div style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;">الصف/المجموعة: <span style="display:inline-block;border-bottom:1px solid #94a3b8;min-width:140px;">&nbsp;</span></div>
        <div style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;">التاريخ: <span style="display:inline-block;border-bottom:1px solid #94a3b8;min-width:120px;">&nbsp;</span></div>
        <div style="padding:8px 12px;border:1px solid #b58900;border-radius:8px;background:#fefce8;font-weight:700;">الدرجة: <span style="display:inline-block;border:1px solid #b58900;border-radius:6px;padding:2px 14px;background:#fff;margin-inline-start:6px;">&nbsp;/ ${total}</span></div>
      </div>
      <div style="margin-top:12px;padding:10px 14px;background:#eff6ff;border-right:3px solid #2563eb;border-radius:8px;font-size:12px;color:#1e3a8a;">
        <b>تعليمات:</b> اقرأ كل سؤال جيدًا قبل الإجابة. أجب بخط واضح، واحرص على تنظيم إجاباتك.
      </div>
      ` : ""}
    </div>
  `;

  const questionHtml = (q: PaperQuestion, i: number) => `
    <div style="padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#fbfaf6;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;border-radius:8px;background:#0f172a;color:#fff;font-weight:800;">${i + 1}</span>
          <span style="font-size:12px;color:#475569;background:#f1f5f9;padding:2px 8px;border-radius:999px;">${typeLabel(q.type)}</span>
        </div>
        ${showPoints ? `<span style="font-size:12px;color:#b58900;font-weight:700;">${Number(q.points) || 0} درجة</span>` : ""}
      </div>
      <div style="font-weight:600;margin-bottom:8px;">${escapeHtml(q.text)}</div>
      ${q.image_url && q.type !== "map" ? `<img src="${q.image_url}" crossorigin="anonymous" style="max-height:220px;max-width:100%;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:8px;" />` : ""}
      ${renderQuestionBody(q, showAnswers)}
      ${showAnswers && q.explanation ? `<div style="margin-top:8px;padding:8px;background:#eff6ff;border-right:3px solid #2563eb;border-radius:6px;font-size:12px;color:#1e3a8a;"><b>شرح:</b> ${escapeHtml(q.explanation)}</div>` : ""}
    </div>
  `;

  // A4 portrait @ 96dpi ≈ 794 x 1123 px
  const pageWpx = 794;
  const contentPaddingPx = 36; // matches PDF pt margins (approx 27pt)
  const innerWidthPx = pageWpx - contentPaddingPx * 2;

  // Rasterize header and each question independently so we can pack them
  // into A4 pages without splitting a question across pages.
  const headerCanvas = await rasterizeFragment(headerHtml, innerWidthPx);
  const questionCanvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < opts.questions.length; i++) {
    questionCanvases.push(await rasterizeFragment(questionHtml(opts.questions[i], i), innerWidthPx));
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginPt = 28;
  const bottomReservePt = 22; // room for footer / page number
  const contentWpt = pageW - marginPt * 2;
  const contentHpt = pageH - marginPt * 2 - bottomReservePt;

  const canvasToPt = (c: HTMLCanvasElement) => ({
    w: contentWpt,
    h: (c.height * contentWpt) / c.width,
  });

  const drawFooter = (pageNum: number, pageTotal: number) => {
    const text = `منصة الطارق التعليمية  —  صفحة ${pageNum} / ${pageTotal}`;
    pdf.setFontSize(9);
    pdf.setTextColor(140, 140, 140);
    pdf.text(text, pageW / 2, pageH - 12, { align: "center" });
  };

  // First pass: compute layout so we know total page count for footer.
  type Placement = { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number };
  const pages: Placement[][] = [[]];
  let cursorY = marginPt;

  const place = (canvas: HTMLCanvasElement, allowSplit = false) => {
    const size = canvasToPt(canvas);
    // If it fits on current page, place it.
    if (cursorY + size.h <= marginPt + contentHpt) {
      pages[pages.length - 1].push({ canvas, x: marginPt, y: cursorY, w: size.w, h: size.h });
      cursorY += size.h + 10;
      return;
    }
    // Doesn't fit — start new page (unless page is empty already).
    if (pages[pages.length - 1].length > 0) {
      pages.push([]);
      cursorY = marginPt;
    }
    if (size.h <= contentHpt || !allowSplit) {
      // Either it fits on a fresh page, or we don't split — just place it and
      // let jsPDF scale it down if it's oversized on a fresh page.
      const finalH = Math.min(size.h, contentHpt);
      const finalW = (canvas.width * finalH) / canvas.height * (contentWpt / size.w) * (size.w / contentWpt);
      pages[pages.length - 1].push({
        canvas,
        x: marginPt + (contentWpt - Math.min(size.w, finalW)) / 2,
        y: cursorY,
        w: size.h > contentHpt ? (canvas.width * contentHpt) / canvas.height : size.w,
        h: Math.min(size.h, contentHpt),
      });
      cursorY += Math.min(size.h, contentHpt) + 10;
      return;
    }
    // Split a very tall canvas across multiple pages (used for header/questions
    // that legitimately exceed one page, e.g. long map questions).
    const sliceHeightPx = (contentHpt * canvas.width) / contentWpt;
    let y = 0;
    while (y < canvas.height) {
      const h = Math.min(sliceHeightPx, canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width; slice.height = h;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      const sliceHpt = (h * contentWpt) / canvas.width;
      pages[pages.length - 1].push({ canvas: slice, x: marginPt, y: cursorY, w: contentWpt, h: sliceHpt });
      cursorY += sliceHpt + 10;
      y += h;
      if (y < canvas.height) {
        pages.push([]);
        cursorY = marginPt;
      }
    }
  };

  place(headerCanvas, true);
  for (const c of questionCanvases) place(c, true);

  const totalPages = pages.length;
  pages.forEach((placements, pi) => {
    if (pi > 0) pdf.addPage();
    for (const p of placements) {
      const data = p.canvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(data, "JPEG", p.x, p.y, p.w, p.h);
    }
    drawFooter(pi + 1, totalPages);
  });

  const fname = (opts.filename || opts.title || "exam").replace(/[\\/:*?"<>|]+/g, "_");
  pdf.save(fname.endsWith(".pdf") ? fname : `${fname}${showAnswers ? "-نموذج-إجابة" : ""}.pdf`);
}
