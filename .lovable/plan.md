# نظام حصص واستهلاك الذكاء الاصطناعي (AI Quotas)

يبني على البنية الحالية (`ai_usage_logs`, `ai_rate_limits`, `ai_cache`, `router.server.ts`) ويضيف طبقة حصص كاملة قابلة للإدارة.

## 1. قاعدة البيانات (Migration)

**جدول `ai_quota_policies`** — سياسات افتراضية حسب الدور:
- `role` (admin/student), `feature` (assistant_message, file_upload, exam_generation, essay_grading, summary, lesson_explain, map_analysis, content_plan)
- `period` (daily/weekly/monthly), `limit_count` (int), `max_file_mb`, `max_pages`
- `enabled` (bool)

**جدول `ai_quota_overrides`** — تجاوزات لكل مستخدم:
- `user_id`, `feature`, `period`, `limit_count`, `unlimited` (bool), `notes`
- unique(user_id, feature)

**جدول `ai_quota_usage`** — عدّاد الاستهلاك الحالي:
- `user_id`, `feature`, `period_key` (نص: `2026-07-24` أو `2026-W30` أو `2026-07`)
- `count` (int), `last_used_at`
- unique(user_id, feature, period_key) — يُزاد بـ atomic upsert.

**توسعة `ai_usage_logs`**: عمود `feature` (نص) + `charged` (bool) لتمييز الطلبات التي خُصمت من الحصة.

RLS: الطالب يقرأ حصته فقط. الأدمن يقرأ/يعدّل الكل. `service_role` كامل.

## 2. طبقة الـ Quotas (`src/lib/ai/quotas.server.ts`)

- `resolveQuota(userId, role, feature)` → يدمج override + policy → `{ limit, unlimited, period, max_file_mb, max_pages }`.
- `checkAndReserve(userId, feature)`: قبل الاستدعاء — يرفع `QuotaExceededError` مع `resetAt` عربي.
- `commitUsage(userId, feature)`: بعد النجاح فقط — atomic increment. الأخطاء لا تُحتسب.
- `rollback(userId, feature)`: إذا رجع الطلب من الـ Cache → لا يُحتسب.
- period_key helpers (day/week/month) بتوقيت أفريقيا/القاهرة.

## 3. تكامل مع الـ Router

`callAI(taskType, messages, opts)` يستقبل `feature`:
- Cache hit → لا خصم.
- قبل الطلب: `checkAndReserve`.
- بعد النجاح: `commitUsage` + `logs.charged=true`.
- فشل مزود / خطأ شبكة → لا خصم + `charged=false`.
- حجم الملف والصفحات يُفحص في `document-cache.server.ts` وفق `max_file_mb`/`max_pages`.

خريطة `taskType → feature` مبدئية:
- `student_assistant` → `assistant_message`
- `student_file_analysis` → `file_upload`
- `exam_generation_*` → `exam_generation`
- `essay_grade` → `essay_grading`
- `map_analysis` → `map_analysis`
- `admin_assistant` → `assistant_message` (بحدود المعلم)

## 4. لوحة الإدارة

**صفحة `/admin/ai/quotas`** (تبويبات):
1. **السياسات الافتراضية** — جدول قابل للتحرير (دور × ميزة × فترة × حد + حجم ملف/صفحات).
2. **الاستثناءات لكل مستخدم** — بحث بالاسم، تعديل حد، تفعيل Unlimited، إعادة تعيين الحصة الحالية.
3. **الاستهلاك اللحظي** — لكل مستخدم: المستخدم/المتبقي لكل ميزة، شريط تقدم، زر Reset.

**توسعة `/admin/ai/usage`**:
- أكثر المستخدمين استهلاكاً (Top 10).
- أكثر الميزات استهلاكاً.
- إجمالي الملفات المرفوعة + الامتحانات المولّدة.

Server functions جديدة في `src/lib/ai-quotas.functions.ts`:
`listQuotaPolicies`, `upsertQuotaPolicy`, `listUserQuotas`, `upsertUserOverride`, `resetUserQuota`, `getQuotaLeaderboard`.

## 5. تجربة المستخدم

عند تجاوز الحد:
- Toast + Dialog: "استهلكت حصتك من [الميزة]. تتجدد يوم/أسبوع/شهر [التاريخ]. للمزيد راسل المعلم."
- Hook `useAiRequest` يعرض الرسالة تلقائياً بدل الخطأ العام.
- زر الإرسال يُعطَّل عند الوصول للحد (استعلام `getMyQuotas` من الطالب).

Server function `getMyQuotas()` للطالب: يعيد الاستهلاك/المتبقي لكل ميزة.

## 6. منع التحايل (موجود جزئياً + تحسينات)

- Rate limiter الحالي يبقى (نافذة الدقيقة).
- Dedupe المطلوب: إعادة استخدام `guardDuplicate` + الاعتماد على `ai_cache` (نفس الملف/نفس الإعدادات → نتيجة محفوظة، لا خصم — مطلوب صراحة).
- زر الإرسال: in-flight lock موجود في `useAiRequest`.
- Audit log: كل `checkAndReserve`/`commitUsage`/`rollback` يُسجَّل في `ai_usage_logs` مع `feature`, `charged`, `cache_hit`.

## تفاصيل تقنية

```
resolveQuota → merge override>policy
checkAndReserve → SELECT count FOR UPDATE → if >= limit throw
commitUsage    → INSERT ... ON CONFLICT DO UPDATE SET count=count+1
```

الفترة (period_key) تُحسب بتوقيت القاهرة لمنع الالتباس.

## ما لن أفعله

- لن أغيّر بنية الجداول الحالية إلا بإضافة أعمدة.
- لن أعدّل نظام الـ Cache الحالي (يعمل).
- لن ألمس صفحات الطالب خارج نقطة عرض الحصة المتبقية في المساعد.

بعد موافقتك أنفّذ الـ migration أولاً ثم الطبقات البرمجية ثم واجهة الإدارة.
