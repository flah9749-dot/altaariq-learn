// Build a wa.me link from any phone input.
// - Strips separators, spaces, and Arabic-Indic digits.
// - Normalizes with a default country code (Egypt = "20") so admins can type
//   local numbers like "01xxxxxxxxx" and Saudi/Gulf numbers like "+9665xxx".

const AR_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EA_INDIC = "۰۱۲۳۴۵۶۷۸۹";

function toWesternDigits(s: string): string {
  let out = "";
  for (const ch of s) {
    const a = AR_INDIC.indexOf(ch);
    if (a >= 0) { out += a; continue; }
    const b = EA_INDIC.indexOf(ch);
    if (b >= 0) { out += b; continue; }
    out += ch;
  }
  return out;
}

/**
 * Normalize a phone number to the E.164-ish digit string wa.me expects
 * (country code + subscriber number, no plus, no spaces).
 *
 * Rules:
 *  - Any leading '+' means the caller already provided a country code.
 *  - '00xxxx' → 'xxxx' (international prefix stripped).
 *  - Leading '0' → replaced by defaultCountryCode (local number).
 *  - Otherwise (already looks international) → returned as-is.
 */
export function normalizePhoneForWhatsApp(
  raw: string | null | undefined,
  defaultCountryCode: string = "20",
): string | null {
  if (!raw) return null;
  let s = toWesternDigits(String(raw)).trim();
  const hasPlus = s.startsWith("+");
  s = s.replace(/[^\d]/g, "");
  if (!s) return null;
  if (hasPlus) {
    // already international
  } else if (s.startsWith("00")) {
    s = s.slice(2);
  } else if (s.startsWith("0")) {
    s = defaultCountryCode.replace(/\D/g, "") + s.slice(1);
  }
  // Sanity: at least 8 digits for a valid international number.
  if (s.length < 8) return null;
  return s;
}

export function whatsappUrl(
  rawNumber: string | null | undefined,
  message?: string,
  defaultCountryCode: string = "20",
): string | null {
  const digits = normalizePhoneForWhatsApp(rawNumber, defaultCountryCode);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (message) return `${base}?text=${encodeURIComponent(message)}`;
  return base;
}
