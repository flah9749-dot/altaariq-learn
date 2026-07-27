// Server-only helpers for the self-registration flow.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
export function generatePassword(len = 10): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

export function generateStudentCode(prefix = "STD"): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const n = Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${prefix}-${n.slice(0, 6)}`;
}

export function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

/**
 * Normalize a phone to a wa.me-ready digit string (country code + subscriber, no +/0).
 * - "+cc..." → strips "+"
 * - "00..."  → strips "00"
 * - "0..."   → replaces leading 0 with default country code
 * - otherwise → returned as-is
 */
export function normalizeIntlPhone(raw: string, defaultCc = "20"): string {
  let s = String(raw ?? "").trim();
  const hasPlus = s.startsWith("+");
  s = s.replace(/\D/g, "");
  if (!s) return "";
  if (hasPlus) return s;
  if (s.startsWith("00")) return s.slice(2);
  if (s.startsWith("0")) return defaultCc.replace(/\D/g, "") + s.slice(1);
  return s;
}

export function normalizeCode(c: string): string {
  return c.trim().toUpperCase();
}

export function buildWhatsAppText(opts: {
  platformName: string;
  studentName: string;
  studentCode: string;
  password: string;
  loginUrl: string;
}): string {
  return [
    `مرحباً بكم في ${opts.platformName} 🎓`,
    ``,
    `تم إنشاء حساب الطالب:`,
    `الاسم: ${opts.studentName}`,
    `كود الطالب: ${opts.studentCode}`,
    `كلمة المرور: ${opts.password}`,
    ``,
    `رابط تسجيل الدخول:`,
    opts.loginUrl,
    ``,
    `يرجى الاحتفاظ بهذه البيانات في مكان آمن.`,
  ].join("\n");
}
