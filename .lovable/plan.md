# نظام التسجيل الذاتي للطلاب (Self Registration)

نظام يتيح للطالب إنشاء حسابه بنفسه عبر كود انضمام (Invitation Code) خاص بصفٍ ومجموعة، مع خيار مراجعة الأدمن اليدوية وإرسال بيانات الدخول عبر واتساب.

---

## 1) قاعدة البيانات (Migration واحدة)

### جدول `join_codes`
- `code` (نص فريد، uppercase)
- `class_id`, `group_id` (FK — كلاهما إجباري)
- `active` (bool)
- `expires_at` (timestamptz — اختياري)
- `max_uses` (int — اختياري، NULL = بلا حد)
- `used_count` (int, default 0)
- `notes` (نص)
- `created_by`, `created_at`, `updated_at`

**Grants + RLS**: قراءة/كتابة للأدمن فقط. مع ذلك التحقق للطالب يتم عبر **دالة SECURITY DEFINER** (لا يحتاج قراءة الجدول مباشرة).

### جدول `registration_requests`
- `code_id` (FK → join_codes)
- `full_name`, `student_phone`, `parent_phone`, `parent_name`
- `class_id`, `group_id` (منسوخة من الكود)
- `avatar_url` (اختياري)
- `status` (`pending` | `approved` | `rejected` | `auto_approved`)
- `student_id` (FK → students بعد الاعتماد)
- `reject_reason`
- `ip_address`, `user_agent`
- `created_at`, `reviewed_at`, `reviewed_by`

**Grants + RLS**: كتابة الأنونيموس ممنوعة (تمر عبر server function). الأدمن فقط يقرأ ويعدل.

### إعدادات في `settings`
- `self_registration.enabled` (bool)
- `self_registration.auto_approve` (bool)
- `self_registration.send_to_student_phone` (bool)

### دوال قاعدة البيانات
- `public.validate_join_code(_code text)` — SECURITY DEFINER تُرجع `{valid, class_id, group_id, class_name, group_name, reason}` للاستخدام من الطالب دون كشف الجدول.
- `public.increment_join_code_use(_code_id uuid)` — تزيد `used_count` بذرية.

---

## 2) Server Functions

ملف `src/lib/self-registration.functions.ts` (thin wrappers فقط):

- `validateJoinCode({ code })` — عام (بدون Auth) → تُرجع الصف والمجموعة أو خطأ.
- `submitRegistration({ code, full_name, student_phone, parent_phone, avatar_url })` — عام. تتحقق من:
  - صحة الكود + انتهاء الصلاحية + الحد الأقصى.
  - عدم تكرار رقم الطالب في `students`.
  - Rate limit بسيط عبر IP + كود (قيد على `registration_requests` أو فحص عدد الطلبات في آخر 10 دقائق).
  - عدم تكرار الطلب المعلّق بنفس الرقم.
  - يُنشئ سجل `registration_requests`.
  - إذا `auto_approve = true` → يستدعي `approveRegistration` داخلياً.
  - يُرجع `{ status, message, credentials? }`.

ملف `src/lib/self-registration.admin.functions.ts` (محمي بـ `requireSupabaseAuth` + فحص دور admin):
- `listJoinCodes`, `createJoinCode`, `updateJoinCode`, `deleteJoinCode`.
- `listRegistrationRequests({ status? })`, `approveRegistration({ id, overrides? })`, `rejectRegistration({ id, reason })`.
- `getRegistrationStats()` — يوميات + إجماليات.

`approveRegistration` يستخدم `supabaseAdmin` داخل الـ handler لـ:
1. إنشاء مستخدم Auth عبر `auth.admin.createUser` بإيميل وهمي وكلمة مرور عشوائية قوية.
2. إنشاء صف في `students` مع `class_id`, `group_id`, `student_code`, `plaintext_password`.
3. تعيين دور `student` في `user_roles`.
4. `increment_join_code_use`.
5. تحديث `registration_requests.status` و `student_id`.
6. توليد نص رسالة واتساب (لا نُرسل من الخادم — نُرجع رابط `wa.me` للأدمن، ويُعرض تلقائياً بعد التسجيل الذاتي للطالب لفتحه).

---

## 3) الصفحات (Routes)

### واجهات عامة
- `src/routes/register.tsx` — واجهة تسجيل الطالب (خطوتين):
  1. إدخال كود الانضمام → تحقق فوري → يعرض الصف والمجموعة.
  2. نموذج البيانات (اسم رباعي، هاتف الطالب، هاتف ولي الأمر، صورة اختيارية، موافقة على الشروط).
  - بعد الإرسال: شاشة نجاح تعرض كود الطالب وكلمة المرور (إن `auto_approve`) + زر واتساب لولي الأمر جاهز، أو "طلبك قيد المراجعة" (إن يدوي).
- زر "🎓 التسجيل لأول مرة" في `src/routes/login.tsx`.

### واجهات الأدمن
- `src/routes/admin.join-codes.tsx` — CRUD + إحصائيات لكل كود (عدد الطلاب، تاريخ الانتهاء، تفعيل/تعطيل، نسخ الكود، طباعة QR).
- `src/routes/admin.registration-requests.tsx` — قائمة الطلبات المعلقة/المعتمدة/المرفوضة مع فلاتر + تبويبات، وأزرار قبول/رفض/تعديل قبل الاعتماد.
- إضافة رابطين في `AdminSidebar`.
- بلوك إعدادات جديد في `src/routes/admin.settings.tsx` لتفعيل النظام + الموافقة التلقائية + الإرسال لرقم الطالب.

---

## 4) الأمان

- كل الكتابات العامة تمر عبر server functions مع `zod` validation.
- منع تسجيل نفس رقم الهاتف مرتين (فحص + قيد UNIQUE على `students.phone` إن لم يوجد).
- تسجيل `ip_address` و `user_agent` من `getRequest()`.
- Rate limit: منع أكثر من 5 طلبات من نفس IP في 10 دقائق (استعلام بسيط قبل الإدراج).
- RLS: `registration_requests` لا تسمح للأنون بالقراءة (تُرجع الحالة عبر الـ server function).
- الكود يُخزّن ويُقارن بعد `upper(trim())`.

---

## 5) الاختبار

بعد التنفيذ سأشغّل السيناريوهات التالية عبر Playwright أو استدعاءات مباشرة:
- تسجيل ناجح بكود صالح.
- كود منتهي / معطّل / تجاوز الحد.
- تكرار رقم الطالب.
- Auto-approve مقابل مراجعة يدوية.
- زر واتساب يحمل البيانات الصحيحة.

---

## تفاصيل تقنية موجزة

- استخدام `random_bytes` لكلمة المرور: 12 حرف A-Za-z0-9.
- كود الطالب: نفس النمط الحالي المستخدم في `students` (سيتم استخراج المنطق من `students.functions.ts`).
- إيميل وهمي: `{student_code}@altaariq.local` (يتماشى مع نظام الطلاب الحالي).
- QR: يستخدم مكوّن `StudentIDCard` الموجود.
- رسالة واتساب: قالب من `message_templates` إن وجد، وإلا نص افتراضي.

## ملفات جديدة

- `src/lib/self-registration.functions.ts` (عام)
- `src/lib/self-registration.admin.functions.ts` (أدمن)
- `src/lib/self-registration.server.ts` (مساعدات)
- `src/routes/register.tsx`
- `src/routes/admin.join-codes.tsx`
- `src/routes/admin.registration-requests.tsx`
- Migration واحدة تشمل الجدولين + الدوال + السياسات + الإعدادات.

## ملفات معدّلة

- `src/routes/login.tsx` (زر التسجيل)
- `src/components/admin/AdminSidebar.tsx` (رابطان)
- `src/routes/admin.settings.tsx` (إعدادات النظام)