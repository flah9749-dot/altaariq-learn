
# 🗺️ امتحان الخرائط الذكي (AI Map Exam)

نوع امتحان مستقل بالكامل — ليس سؤالاً داخل امتحان عادي. له تدفق إنشاء خاص، شاشة مراجعة خاصة، وواجهة طالب مخصصة.

## المرحلة 1 — قاعدة البيانات

إضافة عمود `exam_kind` لجدول `exams`:
- `'standard'` (الافتراضي، الامتحانات الحالية تبقى كما هي)
- `'map'` (النوع الجديد)

جدول جديد `map_exam_pages` (خريطة واحدة أو أكثر لكل امتحان):
- `exam_id`, `order_index`, `original_image_url`, `clean_image_url`, `title`, `map_type` (مصر/الوطن العربي/تضاريس/...).

جدول جديد `map_exam_markers`:
- `page_id`, `number` (1، 2، 3...), `x`, `y` (نسبة مئوية), `label` (اسم المكان — داخلي للأدمن).

جدول جديد `map_exam_questions`:
- `marker_id`, `type` (mcq/true_false/short/essay), `text`, `answer`, `options` (JSONB), `points`, `order_index`.

RLS + GRANT كاملة (أدمن يدير، الطالب يقرأ عند فتح امتحان منشور، الإجابات تُخزن في `attempt_answers` الحالي مع `question_ref` جديد).

## المرحلة 2 — Backend (Server Functions)

`src/lib/map-exam.functions.ts` جديد:
- `createMapExam` — إنشاء هيكل امتحان خرائط فارغ.
- `uploadMapPage` — رفع صورة/PDF/سكرين شوت (تحويل PDF لصورة أول صفحة).
- `aiAutoBuildMapPage` — التدفق الكامل بالـ AI:
  1. تحليل الخريطة (`identifyMapType`) — التعرف على نوع الخريطة.
  2. تنظيف الصورة (يستخدم `cleanMapImage` الحالي — مسح كل النصوص/الأسماء/الأسهم).
  3. تحليل النقاط (يستخدم `analyzeMapImage` الحالي — إحداثيات دقيقة).
  4. توليد سؤال + إجابة لكل نقطة (MCQ/short حسب نوع الخريطة).
- `saveMapExamDraft` — حفظ نتائج المراجعة (Markers + أسئلة + إجابات + درجات).
- `submitMapExamAttempt` — استلام إجابات الطالب.
- `gradeMapExamAttempt` — تصحيح تلقائي للموضوعية، الاحتفاظ بالمقالية للأدمن (نفس منطق `evalMapSubQuestion` الحالي).

يستخدم نظام تعدد المزودين الموجود مع Fallback (`callLovableChat`).

## المرحلة 3 — واجهة الأدمن

**نقطة الدخول**: في `/admin/exams` زر جديد بجانب "امتحان جديد" و"AI":
- `🗺️ امتحان خرائط ذكي` → مسار جديد `/admin/exams/map/new`.

**صفحة إنشاء امتحان الخرائط** (`admin.exams.map.new.tsx`):
- الخطوة 1: بيانات أساسية (عنوان، صف، مدة، درجة).
- الخطوة 2: رفع خريطة (Drag&drop + كاميرا + PDF).
- الخطوة 3: زرّان بارزان:
  - `🧠 إنشاء تلقائي بالذكاء الاصطناعي` (يشغّل `aiAutoBuildMapPage` كامل).
  - `✏️ إنشاء يدوي` (يفتح المحرر مباشرة دون AI).
- الخطوة 4 (شاشة المراجعة): محرر تفاعلي موحّد يعتمد على `InteractiveMapEditor` الحالي مع توسعة:
  - سحب Markers / حذف / إضافة / تغيير الرقم.
  - Panel جانبي لكل Marker: قائمة أسئلة (يدعم أنواع MCQ/TF/Short/Essay) + درجات.
  - زر "إضافة خريطة أخرى" (multi-page).
  - زر "إعادة التنظيف" / "إعادة التحليل".
- الخطوة 5: حفظ ونشر.

## المرحلة 4 — واجهة الطالب

مسار `student.exams.$id.take.tsx` يفحص `exam.exam_kind`:
- إذا `standard` → نفس المسار الحالي (بدون تغيير).
- إذا `map` → مكوّن جديد `MapExamRunner`:
  - عرض الخريطة النظيفة (Responsive: pinch/zoom على الموبايل).
  - Markers مرقّمة فوق الصورة (نفس التنسيق البصري للمحرر).
  - أسفلها قائمة الأسئلة مجمّعة حسب الرقم: `الرقم (1) → ما اسم...؟`.
  - حفظ تلقائي كل بضع ثوان (نفس آلية الحفظ الحالية).
  - عدة صفحات خرائط تُعرض واحدة تلو الأخرى مع Progress.
- صفحة النتيجة (`student.exams.$id.result`) تعرض الخريطة مع الإجابة الصحيحة بجانب إجابة الطالب لكل Marker.

## المرحلة 5 — التصحيح والنتائج

- الموضوعية: تصحيح آلي فور التسليم (نفس `evalMapSubQuestion`).
- المقالية: تظهر في `/admin/exams/$id/results` مع اقتراح تصحيح AI الموجود.
- عرض النتائج الإجمالية يعمل كما هو (نفس جدول `results`).

## المرحلة 6 — الاختبار

بعد التنفيذ:
1. اختبار E2E عبر Playwright: رفع خريطة → AI auto → مراجعة → حفظ → دخول كطالب → حل → عرض نتيجة.
2. اختبار المسار اليدوي (بدون AI).
3. اختبار Responsive على viewport موبايل + تابلت + سطح مكتب.
4. اختبار Fallback بين مزودي الـ AI.

## قواعد الحفاظ على الكود القائم

- **لا نلمس** نظام سؤال الخريطة داخل الامتحان العادي (`question.type='map'`) — يبقى كما هو للتوافق.
- **نُعيد استخدام**: `analyzeMapImage`, `cleanMapImage`, `InteractiveMapEditor`, `MapPointQuestions`, `evalMapSubQuestion`, `callLovableChat`, `attempt_answers`.
- **جديد فقط**: `exam_kind`, 3 جداول `map_exam_*`, `map-exam.functions.ts`, مسارات `/admin/exams/map/new` و `MapExamRunner`.

## التقنيات

- Frontend: React + TS + shadcn/ui + Tailwind (RTL).
- محرر الخريطة: HTML5 + pointer events (يعمل touch/mouse).
- تحويل PDF → صورة: `pdfjs-dist` (موجود بالفعل في المشروع).
- AI: `callLovableChat` مع Gemini 3 Pro Vision للتحليل، Nano Banana للتنظيف، fallback chain موجود.
- Storage: bucket جديد `map-exams` (RLS: أدمن write، مصادق read).
