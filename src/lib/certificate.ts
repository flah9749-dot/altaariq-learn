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

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * The certificate is rendered as real RTL Arabic HTML then rasterized,
 * because jsPDF's built-in fonts cannot shape Arabic text.
 */
function buildCertificateHtml(d: CertificateData, logo: string | null, qr: string) {
  const stats = [
    { label: "الدرجة", value: `${d.score} / ${d.total}` },
    { label: "النسبة", value: `${d.percentage}%` },
    ...(d.grade ? [{ label: "التقدير", value: d.grade }] : []),
    ...(d.rank ? [{ label: "الترتيب", value: d.rank }] : []),
  ];

  return `
  <div style="width:1485px;height:1050px;position:relative;background:#F8F5EB;
              font-family:Cairo,Tajawal,'Segoe UI',sans-serif;direction:rtl;box-sizing:border-box;padding:40px;">
    <div style="position:absolute;inset:40px;border:10px solid #1E293B;"></div>
    <div style="position:absolute;inset:60px;border:3px solid #D4AF37;"></div>

    <div style="position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:70px 90px;box-sizing:border-box;">
      <div style="width:100%;background:#1E293B;border-radius:14px;padding:18px 28px;display:flex;align-items:center;gap:20px;">
        ${logo ? `<img src="${logo}" style="width:70px;height:70px;object-fit:contain;" />` : ""}
        <div style="flex:1;text-align:center;">
          <div style="color:#D4AF37;font-size:40px;font-weight:800;line-height:1.3;">منصة الطارق التعليمية</div>
          <div style="color:#ffffff;font-size:20px;">الدراسات الاجتماعية</div>
        </div>
        <div style="width:70px;"></div>
      </div>

      <div style="margin-top:48px;color:#1E293B;font-size:58px;font-weight:800;">شهادة تقدير</div>
      <div style="margin-top:14px;color:#5B6472;font-size:24px;">تُمنح هذه الشهادة بكل فخر إلى الطالب/ة</div>

      <div style="margin-top:26px;color:#1E293B;font-size:56px;font-weight:800;">${esc(d.studentName || "-")}</div>
      <div style="width:640px;height:5px;background:#D4AF37;border-radius:3px;margin-top:12px;"></div>

      <div style="margin-top:34px;color:#5B6472;font-size:24px;">لاجتيازه بنجاح امتحان</div>
      <div style="margin-top:10px;color:#1E293B;font-size:34px;font-weight:700;text-align:center;max-width:1100px;">${esc(d.examTitle || "-")}</div>

      <div style="margin-top:40px;display:flex;gap:22px;">
        ${stats
          .map(
            (s) => `<div style="background:#1E293B;border-radius:14px;padding:18px 30px;min-width:190px;text-align:center;">
            <div style="color:#D4AF37;font-size:20px;">${esc(s.label)}</div>
            <div style="color:#ffffff;font-size:34px;font-weight:800;margin-top:6px;">${esc(s.value)}</div>
          </div>`,
          )
          .join("")}
      </div>

      <div style="margin-top:auto;width:100%;display:flex;align-items:flex-end;justify-content:space-between;">
        <div style="text-align:center;">
          <img src="${qr}" style="width:130px;height:130px;" />
          <div style="color:#5B6472;font-size:16px;margin-top:6px;">امسح للتحقق</div>
          <div style="color:#5B6472;font-size:15px;font-family:monospace;">${esc(d.attemptId.slice(0, 8))}</div>
        </div>
        <div style="text-align:center;">
          <div style="width:320px;border-bottom:3px solid #1E293B;height:40px;"></div>
          <div style="color:#1E293B;font-size:22px;font-weight:700;margin-top:8px;">توقيع المدرس</div>
          <div style="color:#5B6472;font-size:18px;margin-top:6px;">تاريخ الإصدار: ${esc(d.date)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

export async function generateCertificatePdf(d: CertificateData) {
  const verifyUrl = `${window.location.origin}/verify/${d.attemptId}`;
  const [{ default: jsPDF }, { default: html2canvas }, logoDataUrl, qrDataUrl] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
    loadImageAsDataUrl(appIcon),
    QRCode.toDataURL(verifyUrl, { width: 320, margin: 1 }),
  ]);

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;";
  host.innerHTML = buildCertificateHtml(d, logoDataUrl, qrDataUrl);
  document.body.appendChild(host);

  try {
    // Give webfonts a chance to load so Arabic renders with Cairo/Tajawal.
    try { await (document as any).fonts?.ready; } catch { /* ignore */ }

    const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
      scale: 2,
      backgroundColor: "#F8F5EB",
      useCORS: true,
      logging: false,
    });

    const img = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.addImage(img, "JPEG", 0, 0, 297, 210, undefined, "FAST");
    pdf.save(`Certificate-${(d.studentName || "student").replace(/\s+/g, "_")}.pdf`);
  } finally {
    host.remove();
  }
}
