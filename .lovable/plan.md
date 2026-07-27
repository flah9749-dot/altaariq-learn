# خطة العمل — 3 محاور

## 1) إصلاح تكرار الإشعارات (سبب جذري)

بعد فحص الكود:
- **الإعلانات**: `notify_on_announcement` trigger يعمل على INSERT **و** UPDATE، فأي تحديث لإعلان (تعديل عنوان/إعادة نشر) يُنشئ إشعارًا جديدًا بمفتاح `ann:<id>` — لكن هذا المفتاح ثابت فيمنع التكرار ✓. المشكلة الفعلية: التطبيق قد يستدعي `notifyStudents` أيضًا لبعض المسارات → تكرار.
- **بنك الأسئلة**: `notifyBankPublish` يُستدعى من 4 نقاط مختلفة (`upsert`, `publish`, `bulkImport`, `updateTargets`) لنفس العنصر بنفس `dedupe_key` — إذا انفصلت الاستدعاءات زمنيًا قد تنجح.
- **push tokens**: لا يوجد قيد UNIQUE على token لكل مستخدم — نفس الجهاز قد يسجل توكن متعدد مرات → كل push يُرسل مرتين للجهاز نفسه.
- **FCM SW**: `firebase-messaging-sw.js` قد يعرض إشعار + النظام يعرض واحدًا من نفس الحمولة → إشعاران على نفس الجهاز.

**الإصلاحات**:
- إضافة UNIQUE index على `push_tokens(token)` + upsert بدلاً من insert.
- ضبط `notify_on_announcement` trigger ليعمل على INSERT فقط (`AFTER INSERT`).
- توحيد شرط عرض FCM SW: عدم إظهار notification يدويًا عند وجود `notification` payload (Firebase يعرضها تلقائيًا).
- توسيع `dedupe_key` ليشمل كل المصادر (نتائج الامتحان، رسائل النظام، منح النقاط، اعتماد النتيجة).
- إضافة قيد UNIQUE قوي بدل PARTIAL على مستوى `(user_id, dedupe_key)`.

## 2) تنظيم شامل بالسنة الدراسية → المجموعة

الوضع الحالي: `students` مرتبطون بـ `class_id` + `group_id` مباشرة، والامتحانات/الرسائل/الجوائز تستهدف قوائم مسطحة.

**التغييرات**:
- إضافة **Global Scope Selector** ثابت في هيدر الأدمن: "السنة الدراسية" + "المجموعة" (اختياري) → يفلتر كل الشاشات تلقائيًا.
- تحديث الشاشات لتحترم النطاق:
  - `/admin/students` — فلترة تلقائية.
  - `/admin/exams` — عرض الامتحانات المستهدفة للنطاق فقط + استهداف افتراضي عند الإنشاء.
  - `/admin/messages` — تبويب "حسب المجموعة" مع bulk broadcast للمجموعة.
  - `/admin/rewards` + `/admin/competitions` — استهداف بالصف/المجموعة.
  - `/admin/leaderboard` — Tabs (كل الطلاب / حسب السنة / حسب المجموعة).
  - `/admin/reports` — تقارير لكل صف ومجموعة على حدة.
- حفظ اختيار النطاق في `localStorage` ليبقى ثابتًا بين الجلسات.
- Skip: تعديل قاعدة البيانات — البنية الحالية (`class_id` + `group_id`) كافية.

## 3) تفعيل الجوائز والمسابقات

الجداول `rewards`, `reward_catalog`, `reward_redemptions`, `competitions`, `competition_participants` موجودة. المطلوب:

- **الجوائز**:
  - مراجعة `/admin/rewards` — التأكد من إضافة/تعديل/حذف يعمل، واستبدال بنقاط.
  - صفحة `/student/rewards` — عرض متجر الجوائز مع زر "استبدال" (يخصم نقاط).
  - إشعار عند نجاح الاستبدال + عند موافقة الأدمن.
- **المسابقات**:
  - مراجعة `/admin/competitions` — إنشاء مسابقة (عنوان، وصف، تاريخ بداية/نهاية، النطاق).
  - إضافة صفحة الطالب `/student/competitions` — قائمة المسابقات النشطة + زر المشاركة + الترتيب اللحظي.
  - إعلان تلقائي للفائزين عند انتهاء المسابقة.

## التفاصيل التقنية

- ملفات ستُعدَّل: `notify-helpers.server.ts`, `firebase-messaging-sw.js`, migration جديدة لـ `push_tokens` + `announcements trigger`, `AdminHeader.tsx` (Scope selector), عدة routes admin/student.
- ملفات جديدة: `src/hooks/useAdminScope.ts`, `src/routes/student.competitions.tsx`, مكوّن `ScopeSelector.tsx`.
- migrations: قيد UNIQUE على push_tokens، ضبط announcement trigger، (إن لزم) عمود `scope` في competitions.

## ترتيب التنفيذ

1. **الإشعارات** (أعلى أولوية — يؤثر على كل شيء).
2. **الجوائز والمسابقات** (تفعيل + واجهة طالب).
3. **Scope Selector + تنظيم الشاشات** (الأكبر — قد يحتاج جلسة منفصلة).

هل أبدأ بالمحور الأول والثاني الآن، وأترك المحور الثالث لجلسة تالية بعد التحقق؟ أم تفضل تنفيذ كل شيء في هذه الجلسة دفعة واحدة؟
