import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export function exportToExcel<T extends Record<string, any>>(rows: T[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function escapeHtml(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Renders Arabic content as HTML in a hidden container, then rasterises it
 * with html2canvas-pro (which uses the browser's own text shaper — perfect
 * Arabic ligatures and RTL, unlike jsPDF's built-in text engine).
 */
export async function exportToPdf(opts: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}) {
  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.style.cssText = [
    "position:fixed",
    "top:-10000px",
    "right:0",
    "width:1120px",
    "padding:32px",
    "background:#ffffff",
    "color:#0f172a",
    'font-family:"Cairo","Tajawal","Segoe UI",sans-serif',
    "font-size:14px",
    "line-height:1.6",
  ].join(";");

  const headerCells = opts.columns.map((c) => `<th style="padding:10px 12px;background:#1e293b;color:#fff;font-weight:700;text-align:right;border:1px solid #1e293b;">${escapeHtml(c)}</th>`).join("");
  const bodyRows = opts.rows
    .map(
      (r, i) =>
        `<tr style="background:${i % 2 ? "#f8fafc" : "#ffffff"};">${r
          .map((c) => `<td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;">${escapeHtml(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  container.innerHTML = `
    <div style="border-bottom:3px solid #b58900;padding-bottom:12px;margin-bottom:16px;">
      <div style="font-size:13px;color:#64748b;">منصة الطارق التعليمية</div>
      <h1 style="font-size:24px;font-weight:800;margin:6px 0 4px;color:#0f172a;">${escapeHtml(opts.title)}</h1>
      ${opts.subtitle ? `<div style="font-size:13px;color:#475569;">${escapeHtml(opts.subtitle)}</div>` : ""}
      <div style="font-size:11px;color:#94a3b8;margin-top:6px;">${new Date().toLocaleString("ar-EG")}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="${opts.columns.length}" style="padding:24px;text-align:center;color:#94a3b8;border:1px solid #e2e8f0;">لا توجد بيانات</td></tr>`}</tbody>
    </table>
  `;

  document.body.appendChild(container);
  try {
    // Wait a tick so web fonts (Cairo/Tajawal) are applied before rasterising.
    if ((document as any).fonts?.ready) {
      try { await (document as any).fonts.ready; } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, 50));

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 40;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH - 40) {
      pdf.addImage(imgData, "JPEG", 20, 20, imgW, imgH);
    } else {
      // Multi-page slicing
      const pageContentH = pageH - 40;
      const sliceHeightPx = (pageContentH * canvas.width) / imgW;
      let y = 0;
      let first = true;
      while (y < canvas.height) {
        const h = Math.min(sliceHeightPx, canvas.height - y);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = h;
        const ctx = slice.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        const sliceData = slice.toDataURL("image/jpeg", 0.92);
        const sliceHmm = (h * imgW) / canvas.width;
        if (!first) pdf.addPage();
        pdf.addImage(sliceData, "JPEG", 20, 20, imgW, sliceHmm);
        first = false;
        y += h;
      }
    }

    pdf.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
  } finally {
    container.remove();
  }
}
