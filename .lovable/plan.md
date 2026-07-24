# خطة الإصلاحات + بنك الأسئلة

## 1) إصلاح Fallback بين مزودي الذكاء الاصطناعي

**المشكلة**: الراوتر الحالي `src/lib/ai/router.server.ts` يستخدم Lovable Gateway فقط. عند 402/429 لا ينتقل لأي مزود من مفاتيح `ai_api_keys` المخزنة.

**الحل**:
- تعديل `router.server.ts`: بعد فشل جميع نماذج Lovable (402/429/5xx) → استدعاء `ai-multi-provider.server.ts` تلقائياً بأول مزود متاح (Gemini → OpenAI → Groq → OpenRouter → DeepSeek → Mistral → Anthropic حسب الأولوية المحفوظة في `ai_providers`).
- تسجيل المزود المستخدم فعلاً في `ai_usage_logs.provider` بدل ما يكون دائماً "lovable".
- عرض المزود الحالي في لوحة `/admin/ai/usage`.

## 2) إصلاح "استهلكت الحد وأنا مستخدمتش"

**المشكلة**: نظام الحصص يخصم حتى على الطلبات الفاشلة أو التي لم تصل للمزود، وبعض المهام تُخصم مرتين (checkQuota + commit).

**الحل**:
- التأكد أن `commitQuotaUsage` يُستدعى **فقط** بعد نجاح فعلي (بعد `writeCache`).
- تصفير عدّاد `ai_quota_usage` للطلبات الفاشلة الحالية عبر migration واحدة.
- إضافة زر "إعادة تعيين حصتي" في `/admin/ai/quotas` للأدمن.
- رفع الحد الافتراضي للأدمن إلى "غير محدود" (كان محدوداً بالخطأ).

## 3) منع تكرار إشعارات Push

**المشكلة**: نفس الحدث (رسالة/إعلان/امتحان) يولّد صفوفاً متعددة في `notifications` → FCM يرسل نسختين+.

**الحل**:
- إضافة `dedupe_key` (TEXT) على جدول `notifications` مع UNIQUE INDEX جزئي على `(user_id, dedupe_key)` حيث `dedupe_key IS NOT NULL`.
- تحديث كل المُنتجات (`notify_on_message`, `notify_on_announcement`, `dispatch_due_exam_start_notifications`, `apply_points_change`, نشر الامتحانات، نشر النتائج) لملء `dedupe_key` بشكل حتمي (مثلاً: `msg:<uuid>`, `ann:<uuid>`, `exam_start:<exam_id>:<user_id>`, `exam_pub:<exam_id>`, `result:<attempt_id>`).
- التعديل يستخدم `ON CONFLICT DO NOTHING`.
- إضافة قيد على `push_tokens` لمنع نفس التوكن مرتين لنفس المستخدم (موجود جزئياً - سيتم تأكيده).

## 4) استبدال "الملفات" ببنك الأسئلة

**الحذف / الإخفاء**:
- إزالة رابط "الملفات" من `AdminSidebar` وواجهة الطالب.
- الإبقاء على جدول `files` (لا نحذف بيانات) لكن تُخفى الصفحة.

**الجديد - جدول `question_bank`**:
```
- id, admin_id, title, description
- type: 'question' | 'material' (سؤال قابل للإضافة لامتحان أو مادة مرجعية)
- question_type: mcq | true_false | short | essay | map | null (لو material)
- content: JSONB (نص السؤال، الخيارات، الإجابة الصحيحة، الشرح)
- attachments: JSONB[] (ملفات/صور/فيديوهات مرفقة)
- subject: 'history' | 'geography' | 'citizenship' | 'general'
- grade_level, unit, chapter, topic, difficulty, points
- tags[], visibility: 'private' | 'students' (الطلاب يشاهدون فقط visibility='students')
- source: 'manual' | 'ai_generated' | 'imported'
- usage_count, created_at, updated_at
```

**Storage**: bucket جديد `question-bank` (private) للمرفقات، مع RLS تسمح للأدمن CRUD وللطلاب SELECT فقط على المرفقات الظاهرة.

**واجهات الأدمن** (`/admin/question-bank`):
- شبكة/قائمة بفلاتر: نوع السؤال، المادة، الوحدة، الصعوبة، الوسوم.
- إضافة سؤال يدوي (Dialog).
- **توليد أسئلة بالذكاء الاصطناعي** من نص/ملف (يستخدم نظام AI الجديد مع fallback).
- استيراد/تصدير JSON.
- من كل سؤال: زر "إضافة لامتحان" (اختيار امتحان موجود أو إنشاء جديد).
- **إنشاء امتحان من البنك**: اختيار مجموعة أسئلة → توليد امتحان مباشرة (بدون AI) أو مع AI لصياغة أفضل.

**واجهة الطالب** (`/student/question-bank` بديل `/student/files`):
- عرض العناصر التي `visibility='students'`.
- فلترة حسب المادة/الوحدة.
- عرض المرفقات (صور/فيديو/PDF) inline.
- عرض الشرح والإجابة الصحيحة (اختياري - إعداد للأدمن).

**التكامل مع الامتحانات**:
- في `/admin/exams/new` و `/admin/exams/$id`: زر "إضافة من بنك الأسئلة".
- في `/admin/exams/ai`: خيار "احفظ الأسئلة المولّدة في البنك" (Checkbox افتراضي مفعّل).

## الملفات المتأثرة

**Backend/DB**:
- Migration جديدة: جدول `question_bank`، عمود `dedupe_key` على `notifications`، تحديث دوال الإشعارات.
- Storage bucket: `question-bank`.
- `src/lib/ai/router.server.ts`: fallback للمزودين الأخرى.
- `src/lib/ai/quotas.server.ts`: منع الخصم عند الفشل.
- `src/lib/question-bank.functions.ts`: جديد (CRUD + توليد AI + استيراد لامتحان).

**Frontend**:
- `src/routes/admin.question-bank.tsx`: جديد.
- `src/routes/student.question-bank.tsx`: جديد.
- `src/components/admin/AdminSidebar.tsx`: إضافة رابط بنك الأسئلة، إخفاء رابط الملفات.
- `src/components/student/StudentHeader.tsx` + `student.tsx`: نفس الشيء.
- `src/routes/admin.exams.$id.tsx` + `admin.exams.ai.tsx`: زر إضافة من البنك / حفظ في البنك.

## تنفيذ

سأنفذ بالترتيب:
1. Migration (بنك الأسئلة + dedupe_key + إصلاح دوال الإشعارات).
2. إصلاح Router AI (fallback) + Quotas.
3. Backend بنك الأسئلة (server functions).
4. Frontend بنك الأسئلة (أدمن + طالب).
5. ربط بنك الأسئلة بالامتحانات.
6. إخفاء "الملفات" من التنقل.

هذه مرحلة كبيرة. أبدأ بعد موافقتك.
