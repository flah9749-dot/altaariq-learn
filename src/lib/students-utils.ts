export function generateStudentCode(prefix = "STD"): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const t = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${t}${n}`;
}

export function formatArabicDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
  } catch { return "—"; }
}

export function formatArabicDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

export type StudentRow = {
  id: string;
  code: string;
  full_name: string;
  avatar_url: string | null;
  gender: string | null;
  birth_date: string | null;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_whatsapp: string | null;
  address: string | null;
  notes: string | null;
  seat_number: string | null;
  status: string;
  points: number;
  level: number;
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
  class_id: string | null;
  group_id: string | null;
  classes?: { id: string; name: string } | null;
  groups?: { id: string; name: string } | null;
};
