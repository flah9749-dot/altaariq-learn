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
        ${showAnswers ? points.map((p: any) =>
          `<span style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-100%);background:#dc2626;color:#fff;padding:2px 6px;border-radius:999px;font-size:11px;font-weight:700;">📍 ${escapeHtml(p.label)}</span>`
        ).join("") : ""}
      </div>`
    : `<div style="padding:16px;border:1px dashed #94a3b8;border-radius:8px;color:#64748b;">(لم تُرفق صورة الخريطة)</div>`;
  const key = showAnswers && points.length
    ? `<div style="margin-top:6px;color:#16a34a;font-weight:700;">المواقع الصحيحة: ${points.map((p: any) => `${escapeHtml(p.label)} (x:${p.x}, y:${p.y})`).join("، ")}</div>`
    : `<div style="margin-top:6px;color:#64748b;font-size:11px;">حدد الموقع المطلوب على الخريطة بوضع علامة (×).</div>`;
  return `<div>${img}${key}</div>`;
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

export async function exportExamToPdf(opts: ExamPdfOptions) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);
  const showAnswers = !!opts.showAnswers;
  const showPoints = opts.showPoints !== false;
  const total = opts.questions.reduce((a, q) => a + (Number(q.points) || 0), 0);

  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.style.cssText = [
    "position:fixed",
    "top:-10000px",
    "right:0",
    "width:794px",           // A4 @ 96dpi (portrait) ~ 794x1123 px
    "padding:36px 40px",
    "background:#ffffff",
    "color:#0f172a",
    'font-family:"Cairo","Tajawal","Segoe UI",sans-serif',
    "font-size:14px",
    "line-height:1.75",
    "box-sizing:border-box",
  ].join(";");

  const header = `
    <div style="border-bottom:3px solid #b58900;padding-bottom:12px;margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div>
          <div style="font-size:13px;color:#64748b;">منصة الطارق التعليمية — الدراسات الاجتماعية</div>
          <h1 style="font-size:22px;font-weight:800;margin:6px 0 4px;color:#0f172a;">${escapeHtml(opts.title)}</h1>
          ${opts.subtitle ? `<div style="font-size:13px;color:#475569;">${escapeHtml(opts.subtitle)}</div>` : ""}
        </div>
        <div style="text-align:left;font-size:12px;color:#334155;">
          <div>عدد الأسئلة: <b>${opts.questions.length}</b></div>
          ${showPoints ? `<div>الدرجة الكلية: <b>${total}</b></div>` : ""}
          ${showAnswers ? `<div style="color:#dc2626;font-weight:800;margin-top:4px;">نموذج الإجابة</div>` : ""}
        </div>
      </div>
      ${!showAnswers ? `
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;font-size:13px;">
        <div style="flex:1;min-width:180px;">الاسم: <span style="display:inline-block;border-bottom:1px solid #94a3b8;min-width:180px;">&nbsp;</span></div>
        <div style="min-width:140px;">الصف/المجموعة: <span style="display:inline-block;border-bottom:1px solid #94a3b8;min-width:120px;">&nbsp;</span></div>
        <div style="min-width:120px;">التاريخ: <span style="display:inline-block;border-bottom:1px solid #94a3b8;min-width:100px;">&nbsp;</span></div>
        <div style="min-width:120px;">الدرجة: <span style="display:inline-block;border:1px solid #94a3b8;border-radius:6px;padding:2px 12px;">&nbsp;/ ${total}</span></div>
      </div>` : ""}
    </div>
  `;

  const body = opts.questions.map((q, i) => `
    <div style="margin-bottom:18px;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#fbfaf6;page-break-inside:avoid;">
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
  `).join("");

  const footer = `<div style="margin-top:20px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;padding-top:8px;">
    منصة الطارق التعليمية — ${new Date().toLocaleDateString("ar-EG")}
  </div>`;

  container.innerHTML = header + body + footer;
  document.body.appendChild(container);

  try {
    if ((document as any).fonts?.ready) {
      try { await (document as any).fonts.ready; } catch { /* ignore */ }
    }
    // Wait for images to load (best-effort)
    const imgs = Array.from(container.querySelectorAll("img"));
    await Promise.all(imgs.map((img) => new Promise<void>((res) => {
      if ((img as HTMLImageElement).complete) return res();
      img.addEventListener("load", () => res(), { once: true });
      img.addEventListener("error", () => res(), { once: true });
      setTimeout(() => res(), 4000);
    })));
    await new Promise((r) => setTimeout(r, 80));

    const canvas = await html2canvas(container, {
      scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH - margin * 2) {
      const data = canvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(data, "JPEG", margin, margin, imgW, imgH);
    } else {
      const pageContentH = pageH - margin * 2;
      const sliceHeightPx = (pageContentH * canvas.width) / imgW;
      let y = 0; let first = true;
      while (y < canvas.height) {
        const h = Math.min(sliceHeightPx, canvas.height - y);
        const slice = document.createElement("canvas");
        slice.width = canvas.width; slice.height = h;
        const ctx = slice.getContext("2d")!;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        const data = slice.toDataURL("image/jpeg", 0.92);
        const sliceHmm = (h * imgW) / canvas.width;
        if (!first) pdf.addPage();
        pdf.addImage(data, "JPEG", margin, margin, imgW, sliceHmm);
        first = false; y += h;
      }
    }

    const fname = (opts.filename || opts.title || "exam").replace(/[\\/:*?"<>|]+/g, "_");
    pdf.save(fname.endsWith(".pdf") ? fname : `${fname}${showAnswers ? "-نموذج-إجابة" : ""}.pdf`);
  } finally {
    container.remove();
  }
}
