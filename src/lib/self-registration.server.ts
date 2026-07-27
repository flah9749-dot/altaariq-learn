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
