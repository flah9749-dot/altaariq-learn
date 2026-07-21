# اختبار حمل منصة الطارق التعليمية

## الفكرة
محاكاة آلاف الطلاب يحلّون امتحاناً في نفس اللحظة لقياس تحمّل السيرفر قبل الإطلاق الحقيقي.

## المتطلبات
1. **k6** — نزّله من: https://k6.io/docs/get-started/installation/
2. **Node.js** لتشغيل سكربت إنشاء الطلاب الوهميين.
3. **service_role key** لقاعدة البيانات (متاح للمدرس فقط عبر لوحة التحكم — لا يُشارَك).

## الخطوات

### 1) إنشاء امتحان تجريبي
- ادخل بحساب الأدمن → إنشاء امتحان بسيط (10 أسئلة اختيار من متعدد) وانشره.
- انسخ `EXAM_ID` من الرابط، وانسخ `QUESTION_IDS` من جدول `questions`.

### 2) إنشاء طلاب وهميين
```bash
cd load-tests
npm install @supabase/supabase-js
SUPABASE_URL="https://xxx.supabase.co" \
SERVICE_ROLE_KEY="xxx" \
COUNT=3000 \
node seed-test-students.mjs
```
النتيجة: ملف `students.json` فيه 3000 حساب.

### 3) تشغيل الاختبار

**أ) اختبار سريع (10 طلاب — دقيقة واحدة):**
```bash
k6 run \
  --env ANON_KEY="xxx" \
  --env EXAM_ID="uuid-here" \
  --env QUESTION_IDS="id1,id2,id3" \
  --env SCENARIO=smoke \
  exam-load-test.js
```

**ب) تدرّج حتى 500 طالب:**
```bash
k6 run --env SCENARIO=ramp ... exam-load-test.js
```

**ج) ذروة 3000 طالب:**
```bash
k6 run --env SCENARIO=stress ... exam-load-test.js
```

### 4) قراءة النتائج
- **نسبة الأخطاء < 5%** ✅ ممتاز
- **P95 لتسجيل الدخول < 2 ثانية** ✅
- **P95 لحفظ الإجابة < 1.5 ثانية** ✅
- إذا تجاوز أي رقم الحد → السيرفر يحتاج ترقية أو تحسين استعلامات.

### 5) تنظيف بعد الاختبار
احذف حسابات الاختبار من قاعدة البيانات:
```sql
DELETE FROM auth.users WHERE raw_user_meta_data->>'is_load_test' = 'true';
```

## ملاحظات مهمة
- شغّل الاختبار من جهاز بإنترنت قوي (السحابة أفضل: DigitalOcean droplet).
- لا تشغّل الاختبار وقت الحصص الحقيقية.
- Supabase Free/Pro لديه حدود Rate Limit — راقب لوحة Supabase أثناء الاختبار.
- Realtime وPush Notifications غير مشمولة بهذا السكربت (تحتاج WebSocket VUs منفصلين).
