import QRCode from "qrcode";
import appIcon from "@/assets/app-icon.png";

export interface CertificateData {
  studentName: string;
  examTitle: string;
  score: number | string;
  total: number | string;
  percentage: number;
  grade?: string;
  rank?: string;
  attemptId: string;
  date: string;
}

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateCertificatePdf(d: CertificateData) {
  const [{ default: jsPDF }, logoDataUrl] = await Promise.all([
    import("jspdf"),
    loadImageAsDataUrl(appIcon),
  ]);

  const verifyUrl = `${window.location.origin}/verify/${d.attemptId}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 240, margin: 1 });

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210;

  // Background gradient (simulated with rectangles)
  pdf.setFillColor(248, 245, 235); // بيج فاتح
  pdf.rect(0, 0, W, H, "F");

  // Outer border (navy)
  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(2);
  pdf.rect(8, 8, W - 16, H - 16);
  // Inner border (gold)
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.6);
  pdf.rect(12, 12, W - 24, H - 24);

  // Top ribbon
  pdf.setFillColor(30, 41, 59);
  pdf.rect(12, 12, W - 24, 24, "F");
  if (logoDataUrl) {
    try { pdf.addImage(logoDataUrl, "PNG", 18, 15, 18, 18); } catch { /* ignore */ }
  }
  pdf.setTextColor(212, 175, 55);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("AL-TARIQ LEARNING", W / 2, 22, { align: "center" });
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.text("Social Studies Platform", W / 2, 30, { align: "center" });

  // Title
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(30);
  pdf.setFont("helvetica", "bold");
  pdf.text("Certificate of Achievement", W / 2, 60, { align: "center" });

  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text("This is proudly presented to", W / 2, 74, { align: "center" });

  // Student name (large, gold underline)
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 41, 59);
  pdf.text(d.studentName || "-", W / 2, 92, { align: "center" });
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.8);
  pdf.line(W / 2 - 70, 96, W / 2 + 70, 96);

  // Exam
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60, 60, 60);
  pdf.text("For successfully completing the exam:", W / 2, 108, { align: "center" });
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 41, 59);
  pdf.text(d.examTitle || "-", W / 2, 118, { align: "center" });

  // Score row (centered boxes)
  const boxY = 130;
  const boxes = [
    { label: "Score", value: `${d.score} / ${d.total}` },
    { label: "Percentage", value: `${d.percentage}%` },
    ...(d.grade ? [{ label: "Grade", value: d.grade }] : []),
    ...(d.rank ? [{ label: "Rank", value: d.rank }] : []),
  ];
  const bw = 46, gap = 6;
  const startX = W / 2 - (boxes.length * bw + (boxes.length - 1) * gap) / 2;
  boxes.forEach((b, i) => {
    const x = startX + i * (bw + gap);
    pdf.setFillColor(30, 41, 59);
    pdf.roundedRect(x, boxY, bw, 24, 2, 2, "F");
    pdf.setTextColor(212, 175, 55);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(b.label, x + bw / 2, boxY + 8, { align: "center" });
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(b.value), x + bw / 2, boxY + 17, { align: "center" });
  });

  // Footer: date + QR + verify
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Issued on: ${d.date}`, 24, H - 24);
  pdf.text("Teacher's Signature", 24, H - 16);
  pdf.setDrawColor(30, 41, 59);
  pdf.line(24, H - 20, 90, H - 20);

  // QR
  try {
    pdf.addImage(qrDataUrl, "PNG", W - 48, H - 52, 30, 30);
  } catch { /* ignore */ }
  pdf.setFontSize(8);
  pdf.setTextColor(60, 60, 60);
  pdf.text("Scan to verify", W - 33, H - 18, { align: "center" });
  pdf.text(d.attemptId.slice(0, 8), W - 33, H - 14, { align: "center" });

  const fname = `Certificate-${(d.studentName || "student").replace(/\s+/g, "_")}.pdf`;
  pdf.save(fname);
}
