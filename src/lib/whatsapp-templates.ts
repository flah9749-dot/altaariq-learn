// WhatsApp message templates with placeholder substitution.
// Templates are editable from Settings > الرسائل and cached in the `settings` table
// under keys prefixed with "wa.tpl.". When a template is missing, the default here is used.

import { supabase } from "@/integrations/supabase/client";

export type WaTemplateKey =
  | "wa.tpl.general"
  | "wa.tpl.parent_intro"
  | "wa.tpl.student_card"
  | "wa.tpl.student_credentials"
  | "wa.tpl.student_code"
  | "wa.tpl.exam_result"
  | "wa.tpl.exam_result_praise"
  | "wa.tpl.exam_result_encourage"
  | "wa.tpl.exam_reminder"
  | "wa.tpl.exam_link"
  | "wa.tpl.absence"
  | "wa.tpl.attendance"
  | "wa.tpl.fees_reminder"
  | "wa.tpl.parent_credentials"
  | "wa.tpl.teacher_credentials"
  | "wa.tpl.certificate"
  | "wa.tpl.rewards_inquiry"
  | "wa.tpl.teacher_contact";

/** Pick the right result template based on percentage. */
export function pickResultTemplate(percentage: number): WaTemplateKey {
  if (percentage >= 75) return "wa.tpl.exam_result_praise";
  if (percentage < 50) return "wa.tpl.exam_result_encourage";
  return "wa.tpl.exam_result";
}

const DIV = "━━━━━━━━━━━━━━━━━━━━";

export const DEFAULT_WA_TEMPLATES: Record<WaTemplateKey, string> = {
  "wa.tpl.general":
    `السلام عليكم ورحمة الله وبركاته 🌿\n{teacher} — منصة {platform}\n{platform_url}`,

  "wa.tpl.parent_intro":
    `السلام عليكم ولي أمر الطالب/ة {name} 🌿\nمعكم {teacher} من منصة {platform}.\n\n{platform_url}`,

  // Rich student card (spec #1)
  "wa.tpl.student_card":
`${DIV}
🎓 مرحبًا بكم في منصة {platform}

👤 اسم الطالب: {name}
🆔 كود الطالب: {code}
🔐 كلمة المرور: {password}
🏫 الصف: {grade}
📚 المجموعة: {class}

🌐 رابط المنصة:
{platform_url}

سجّل الدخول وابدأ حل الامتحانات ومتابعة مستواك.
نتمنى لك التوفيق 🌹
— {teacher}
${DIV}`,

  "wa.tpl.student_credentials":
`السلام عليكم ولي أمر الطالب/ة {name} 🌿

🔐 بيانات دخول الطالب/ة إلى منصة {platform}:
• الكود: {code}
• كلمة المرور: {password}
• رابط المنصة: {platform_url}

نتشرف بمتابعتكم — {teacher}`,

  "wa.tpl.student_code":
`السلام عليكم 🌿
كود دخول الطالب/ة {name} إلى منصة {platform}: {code}
الرابط: {platform_url}
— {teacher}`,

  // Rich exam result (spec #2)
  "wa.tpl.exam_result":
`${DIV}
📊 نتيجة امتحان جديدة

👤 اسم الطالب: {name}
📝 الامتحان: {exam}
🎯 الدرجة: {score}/{total}
📈 النسبة: {percentage}%
🏅 التقدير: {grade_text}

يمكنك مراجعة تفاصيل النتيجة من المنصة:
{platform_url}

— {teacher} | {platform}
${DIV}`,

  // Praise for high scorers (>=75%)
  "wa.tpl.exam_result_praise":
`${DIV}
🌟 مبروك التفوق!

نبارك لولي أمر الطالب/ة *{name}* على النتيجة المتميزة 🎉

📝 الامتحان: {exam}
🎯 الدرجة: {score}/{total}
📈 النسبة: {percentage}%
🏅 التقدير: {grade_text}

اجتهاد رائع وتركيز واضح، نتمنى الاستمرار على هذا التفوق 💪✨

يمكنكم مراجعة التفاصيل من المنصة:
{platform_url}

— {teacher} | {platform}
${DIV}`,

  // Encouragement for low scorers (<50%)
  "wa.tpl.exam_result_encourage":
`${DIV}
💙 رسالة تحفيز

ولي أمر الطالب/ة *{name}* — تحية طيبة،

📝 الامتحان: {exam}
🎯 الدرجة: {score}/{total}
📈 النسبة: {percentage}%
🏅 التقدير: {grade_text}

نتيجة اليوم ليست نهاية الطريق 🌱
نحتاج تعاونكم في متابعة المذاكرة ومراجعة الأسئلة الخاطئة من المنصة، وأنا مستعد لأي دعم إضافي بإذن الله.

رابط المراجعة:
{platform_url}

بالتوفيق دائمًا 🤍
— {teacher} | {platform}
${DIV}`,

  "wa.tpl.exam_reminder":
`السلام عليكم ولي أمر الطالب/ة {name} 🌿
تذكير بامتحان: {exam}
الموعد: {date}
رابط المنصة: {platform_url}
— {teacher}`,

  // Rich exam link (spec #3)
  "wa.tpl.exam_link":
`${DIV}
📝 لديك امتحان جديد

📘 الامتحان: {exam}
📚 المادة: {subject}
⏱️ المدة: {duration}
🟢 يبدأ: {start_time}
🔴 ينتهي: {end_time}

🔗 رابط الامتحان:
{exam_link}

بالتوفيق ونتمنى لك النجاح 🌟
— {teacher}
${DIV}`,

  // Absence (spec #4)
  "wa.tpl.absence":
`⚠️ إشعار غياب

ولي أمر الطالب: {parent_name}
نحيطكم علمًا بأن الطالب/ة *{name}* تغيب عن الحصة بتاريخ {date}.

يرجى التواصل مع الإدارة عند الحاجة.
— {teacher} | {platform}`,

  // Attendance (spec #5)
  "wa.tpl.attendance":
`✅ تم تسجيل حضور الطالب

👤 اسم الطالب: {name}
📅 التاريخ: {date}
⏰ الوقت: {time}

نتمنى له/لها يومًا موفقًا 🌸
— {teacher}`,

  // Fees (spec #6)
  "wa.tpl.fees_reminder":
`💰 تذكير بالرسوم الدراسية

👤 اسم الطالب: {name}
💵 المبلغ المطلوب: {amount}
🗓️ الشهر: {month}
⏳ آخر موعد للسداد: {due_date}

شكرًا لتعاونكم الكريم.
— {teacher} | {platform}`,

  // Parent credentials (spec #7)
  "wa.tpl.parent_credentials":
`مرحبًا ولي الأمر 👋

بيانات الدخول الخاصة بكم لمنصة {platform}:
👤 الطالب: {name}
🆔 اسم المستخدم: {parent_username}
🔐 كلمة المرور: {parent_password}

🌐 رابط المنصة:
{platform_url}

— {teacher}`,

  // Teacher credentials (spec #8)
  "wa.tpl.teacher_credentials":
`مرحبًا أستاذ 👋

👤 الاسم: {teacher_name}
📚 المادة: {subject}

🔐 بيانات الدخول:
• اسم المستخدم: {username}
• كلمة المرور: {password}

🌐 رابط المنصة:
{platform_url}`,

  // Certificate (spec #9)
  "wa.tpl.certificate":
`🏆 تهانينا!

تم إصدار شهادة جديدة للطالب/ة *{name}*.
يمكنك تحميلها من المنصة:
{certificate_link}

— {teacher} | {platform}`,

  "wa.tpl.rewards_inquiry":
    `السلام عليكم، استفسار بخصوص جوائز الطالب/ة {name}.\n— {teacher}`,

  "wa.tpl.teacher_contact":
    `السلام عليكم أستاذ {teacher} 🌿\nأنا الطالب/ة {name} من منصة {platform}.`,
};

export const WA_TEMPLATE_LABELS: Record<WaTemplateKey, string> = {
  "wa.tpl.general": "رسالة عامة",
  "wa.tpl.parent_intro": "تعريف بولي الأمر",
  "wa.tpl.student_card": "بطاقة الطالب الكاملة (Smart Card)",
  "wa.tpl.student_credentials": "بيانات دخول الطالب",
  "wa.tpl.student_code": "إرسال كود الطالب فقط",
  "wa.tpl.exam_result": "نتيجة امتحان",
  "wa.tpl.exam_result_praise": "نتيجة امتحان — تهنئة بالتفوق",
  "wa.tpl.exam_result_encourage": "نتيجة امتحان — تحفيز وتشجيع",
  "wa.tpl.exam_reminder": "تذكير بامتحان",
  "wa.tpl.exam_link": "إرسال رابط امتحان",
  "wa.tpl.absence": "إشعار غياب",
  "wa.tpl.attendance": "إشعار حضور",
  "wa.tpl.fees_reminder": "تذكير بالرسوم الدراسية",
  "wa.tpl.parent_credentials": "بيانات دخول ولي الأمر",
  "wa.tpl.teacher_credentials": "بيانات دخول المدرس",
  "wa.tpl.certificate": "إصدار شهادة",
  "wa.tpl.rewards_inquiry": "استفسار عن الجوائز",
  "wa.tpl.teacher_contact": "تواصل الطالب مع المدرس",
};

export const WA_TEMPLATE_PLACEHOLDERS: Record<WaTemplateKey, string[]> = {
  "wa.tpl.general": ["teacher", "platform", "platform_url"],
  "wa.tpl.parent_intro": ["name", "teacher", "platform", "platform_url"],
  "wa.tpl.student_card": ["name", "code", "password", "grade", "class", "platform", "platform_url", "teacher"],
  "wa.tpl.student_credentials": ["name", "code", "password", "platform_url", "platform", "teacher"],
  "wa.tpl.student_code": ["name", "code", "platform_url", "platform", "teacher"],
  "wa.tpl.exam_result": ["name", "exam", "score", "total", "percentage", "grade_text", "platform_url", "teacher", "platform"],
  "wa.tpl.exam_reminder": ["name", "exam", "date", "platform_url", "teacher"],
  "wa.tpl.exam_link": ["exam", "subject", "duration", "start_time", "end_time", "exam_link", "teacher"],
  "wa.tpl.absence": ["parent_name", "name", "date", "teacher", "platform"],
  "wa.tpl.attendance": ["name", "date", "time", "teacher"],
  "wa.tpl.fees_reminder": ["name", "amount", "month", "due_date", "teacher", "platform"],
  "wa.tpl.parent_credentials": ["name", "parent_username", "parent_password", "platform", "platform_url", "teacher"],
  "wa.tpl.teacher_credentials": ["teacher_name", "subject", "username", "password", "platform_url"],
  "wa.tpl.certificate": ["name", "certificate_link", "teacher", "platform"],
  "wa.tpl.rewards_inquiry": ["name", "teacher"],
  "wa.tpl.teacher_contact": ["teacher", "name", "platform"],
};

export function fillTemplate(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl
    .replace(/\{(\w+)\}/g, (_, k) => {
      const v = vars[k];
      return v === undefined || v === null || v === "" ? "—" : String(v);
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Simple in-memory cache to avoid hitting the DB on every button click.
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
  const platform_url = typeof window !== "undefined" ? window.location.origin : "";
  return fillTemplate(tpl, {
    platform_url,
    link: platform_url, // backwards compat
    platform: c.ctx.platform || "الطارق التعليمية",
    teacher: c.ctx.teacher || "المدرس",
    ...vars,
  });
}
