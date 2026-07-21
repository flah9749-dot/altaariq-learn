// WhatsApp message templates with placeholder substitution.
// Templates are editable from Settings > الرسائل and cached in the `settings` table
// under keys prefixed with "wa.tpl.". When a template is missing, the default here is used.

import { supabase } from "@/integrations/supabase/client";

export type WaTemplateKey =
  | "wa.tpl.general"
  | "wa.tpl.parent_intro"
  | "wa.tpl.student_credentials"
  | "wa.tpl.student_code"
  | "wa.tpl.exam_result"
  | "wa.tpl.exam_reminder"
  | "wa.tpl.absence"
  | "wa.tpl.attendance"
  | "wa.tpl.fees_reminder"
  | "wa.tpl.rewards_inquiry"
  | "wa.tpl.teacher_contact";

export const DEFAULT_WA_TEMPLATES: Record<WaTemplateKey, string> = {
  "wa.tpl.general":
    "السلام عليكم ورحمة الله وبركاته 🌿\n{teacher} — منصة {platform}",
  "wa.tpl.parent_intro":
    "السلام عليكم ولي أمر الطالب/ة {name} 🌿\nمعكم {teacher} من منصة {platform}.",
  "wa.tpl.student_credentials":
    "السلام عليكم ولي أمر الطالب/ة {name} 🌿\n\nبيانات دخول الطالب/ة لمنصة {platform}:\n• الكود: {code}\n• كلمة المرور: {password}\n• رابط المنصة: {link}\n\nنتشرف بمتابعتكم — {teacher}",
  "wa.tpl.student_code":
    "السلام عليكم 🌿\nكود دخول الطالب/ة {name} إلى منصة {platform}: {code}\nالرابط: {link}\n{teacher}",
  "wa.tpl.exam_result":
    "السلام عليكم ولي أمر الطالب/ة {name} 🌿\nنتيجة امتحان: {exam}\n• الدرجة: {score}/{total}\n• النسبة: {percentage}%\n\n{teacher} — منصة {platform}",
  "wa.tpl.exam_reminder":
    "السلام عليكم ولي أمر الطالب/ة {name} 🌿\nتذكير بامتحان: {exam}\nالموعد: {date}\nرابط المنصة: {link}\n{teacher}",
  "wa.tpl.absence":
    "السلام عليكم ولي أمر الطالب/ة {name}\nنود إبلاغكم بغياب الطالب/ة اليوم بتاريخ {date}.\nنتمنى المتابعة — {teacher}",
  "wa.tpl.attendance":
    "السلام عليكم ولي أمر الطالب/ة {name}\nتم تسجيل حضور الطالب/ة اليوم بحمد الله ✅\n{teacher}",
  "wa.tpl.fees_reminder":
    "السلام عليكم ولي أمر الطالب/ة {name} 🌿\nتذكير ودّي بخصوص الرسوم المستحقة.\nنشكر لكم تعاونكم — {teacher}",
  "wa.tpl.rewards_inquiry":
    "السلام عليكم، استفسار بخصوص جوائز الطالب/ة {name}.\n{teacher}",
  "wa.tpl.teacher_contact":
    "السلام عليكم أستاذ {teacher} 🌿\nأنا الطالب/ة {name} من منصة {platform}.",
};

export const WA_TEMPLATE_LABELS: Record<WaTemplateKey, string> = {
  "wa.tpl.general": "رسالة عامة",
  "wa.tpl.parent_intro": "تعريف بولي الأمر",
  "wa.tpl.student_credentials": "بيانات دخول الطالب (كود + كلمة مرور)",
  "wa.tpl.student_code": "إرسال كود الطالب",
  "wa.tpl.exam_result": "نتيجة امتحان",
  "wa.tpl.exam_reminder": "تذكير بامتحان",
  "wa.tpl.absence": "إشعار غياب",
  "wa.tpl.attendance": "إشعار حضور",
  "wa.tpl.fees_reminder": "تذكير بالرسوم",
  "wa.tpl.rewards_inquiry": "استفسار عن الجوائز",
  "wa.tpl.teacher_contact": "تواصل الطالب مع المدرس",
};

export const WA_TEMPLATE_PLACEHOLDERS: Record<WaTemplateKey, string[]> = {
  "wa.tpl.general": ["teacher", "platform"],
  "wa.tpl.parent_intro": ["name", "teacher", "platform"],
  "wa.tpl.student_credentials": ["name", "code", "password", "link", "platform", "teacher"],
  "wa.tpl.student_code": ["name", "code", "link", "platform", "teacher"],
  "wa.tpl.exam_result": ["name", "exam", "score", "total", "percentage", "teacher", "platform"],
  "wa.tpl.exam_reminder": ["name", "exam", "date", "link", "teacher"],
  "wa.tpl.absence": ["name", "date", "teacher"],
  "wa.tpl.attendance": ["name", "teacher"],
  "wa.tpl.fees_reminder": ["name", "teacher"],
  "wa.tpl.rewards_inquiry": ["name", "teacher"],
  "wa.tpl.teacher_contact": ["teacher", "name", "platform"],
};

export function fillTemplate(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null || v === "" ? "" : String(v);
  }).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Simple in-memory cache to avoid hitting Supabase on every button click.
let cache: { at: number; templates: Record<string, string>; ctx: Record<string, string> } | null = null;
const TTL_MS = 60_000;

async function loadCache() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const { data } = await supabase.from("settings").select("key,value");
  const templates: Record<string, string> = {};
  const ctx: Record<string, string> = {};
  (data ?? []).forEach((r: any) => {
    const val = typeof r.value === "string" ? r.value : (r.value?.value ?? r.value?.text ?? "");
    if (typeof r.key === "string" && r.key.startsWith("wa.tpl.")) {
      templates[r.key] = String(val ?? "");
    }
    if (r.key === "platform.name") ctx.platform = String(val ?? "");
    if (r.key === "teacher.display_name") ctx.teacher = String(val ?? "");
  });
  cache = { at: Date.now(), templates, ctx };
  return cache;
}

export function invalidateWaTemplateCache() { cache = null; }

/**
 * Build a ready-to-send WhatsApp message for a given template with variables.
 * Reads templates + platform/teacher context from the settings table.
 */
export async function buildWaMessage(
  key: WaTemplateKey,
  vars: Record<string, string | number | null | undefined> = {},
): Promise<string> {
  const c = await loadCache();
  const tpl = c.templates[key] || DEFAULT_WA_TEMPLATES[key];
  const link = typeof window !== "undefined" ? window.location.origin : "";
  return fillTemplate(tpl, {
    link,
    platform: c.ctx.platform || "الطارق التعليمية",
    teacher: c.ctx.teacher || "المدرس",
    ...vars,
  });
}
