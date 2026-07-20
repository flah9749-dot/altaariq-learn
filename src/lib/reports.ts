import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AMIRI_FONT_URL = "https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.0.20/files/amiri-arabic-400-normal.woff";

let arabicFontLoaded = false;
async function ensureArabicFont(doc: jsPDF) {
  if (arabicFontLoaded) return;
  try {
    const r = await fetch(AMIRI_FONT_URL);
    const buf = await r.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    doc.addFileToVFS("Amiri.woff", b64);
    doc.addFont("Amiri.woff", "Amiri", "normal");
    arabicFontLoaded = true;
  } catch { /* fallback to default */ }
}

export function exportToExcel<T extends Record<string, any>>(rows: T[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export async function exportToPdf(opts: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
  await ensureArabicFont(doc);
  try { doc.setFont("Amiri"); } catch { /* ignore */ }
  doc.setFontSize(18);
  doc.text(opts.title, doc.internal.pageSize.getWidth() - 40, 40, { align: "right" });
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text("منصة الطارق التعليمية", doc.internal.pageSize.getWidth() - 40, 58, { align: "right" });
  if (opts.subtitle) doc.text(opts.subtitle, doc.internal.pageSize.getWidth() - 40, 74, { align: "right" });

  autoTable(doc, {
    startY: 90,
    head: [opts.columns],
    body: opts.rows,
    styles: { font: arabicFontLoaded ? "Amiri" : "helvetica", halign: "right", fontSize: 10 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    theme: "striped",
  });

  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}
