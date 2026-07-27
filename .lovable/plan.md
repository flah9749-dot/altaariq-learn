## المرحلة الجديدة — الإنجازات (Gamification) والتحليلات المتقدمة

سأنفذ الطلب على 4 محاور مترابطة، مع إعادة استخدام كل ما هو موجود فعلاً (`gamification.ts`, `student.achievements.tsx`, `admin.students.$id.analytics.tsx`, `admin.reports.tsx`, `admin.leaderboard.tsx`).

### 1) صفحة إنجازات الطالب بأسلوب الألعاب — `/student/achievements` (إعادة تصميم)
لوحة واحدة أنيقة تحوي:
- **بطاقة الملف (Player Card):** الصورة، الاسم، المستوى، شريط XP للمستوى التالي (`points` مقابل `levels.min_points`).
- **إحصائيات سريعة (Grid):** عدد الامتحانات المُنجَزة، عدد الأسئلة المُجاب عليها، الإجابات الصحيحة، أسئلة الخرائط، الترتيب العام، عدد الجوائز، عدد الميداليات، إجمالي XP.
- **تبويبات:** الشارات / الإنجازات / الجوائز المُستبدلة (تحتفظ بالمنطق الحالي).
- **مقارنة الطالب بنفسه:** آخر امتحانين — الفارق والنسبة + رسم بياني بسيط (Sparkline من recharts) لآخر 6 محاولات.
- **مقارنة الطالب بزملائه:** "المركز X من أصل Y — أفضل من Z% من نفس الصف" (احتساب من `students.points` داخل نفس `class_id`).

### 2) لوحة "التحليل الذكي للامتحان" للمدرس — `/admin/exams/$id/analytics` (جديد)
لكل امتحان مُعتَمَد، تحليل الأسئلة والوحدات:
- **تحليل كل سؤال:** نسبة الإجابات الصحيحة/الخاطئة، تصنيف تلقائي (سهل / متوسط / صعب) بناءً على النسبة، تمييز الأسئلة "المشكلة" (>60% خطأ) بشارة حمراء.
- **تحليل الوحدات:** تجميع أسئلة الامتحان حسب `questions.difficulty` أو نوع السؤال (وحدة/تصنيف)، وحساب متوسط النجاح لكل وحدة → عرض "الوحدة X: صعبة/سهلة".
- **الخرائط:** إذا كان في الامتحان أسئلة `type='map'`، بطاقة خاصة "الخرائط — مشكلة عند معظم الطلاب" مع أسوأ 3 نقاط.
- زر دخول من صفحة نتائج الامتحان الحالية.

### 3) كأس الأسبوع — بطاقة على `/admin/dashboard` و`/admin/leaderboard`
بطاقة "🏆 كأس الأسبوع" تعرض:
- أفضل طالب (أعلى `sum(points_log.points)` آخر 7 أيام).
- أفضل صف (أعلى متوسط `percentage` من `exam_attempts` آخر 7 أيام).
- أفضل مجموعة (نفس المنطق على مستوى `group_id`).

### 4) شهادة PDF تلقائية بعد الامتحان — على `/student/exams/$id/result`
زر "🎓 تحميل الشهادة" يولّد PDF (jsPDF موجود في `reports.ts`) يحتوي:
- شعار المنصة + اسم الطالب + اسم الامتحان + الدرجة والنسبة + الترتيب داخل الامتحان + رمز QR للتحقق (رابط `/verify/{attempt_id}`).
- صفحة تحقق عامة `/verify/$attemptId` تعرض ملخص الشهادة (بدون بيانات حساسة).

### التفاصيل التقنية

- **بدون تغييرات schema جديدة** — كل شيء يُحسب من الجداول الحالية (`exam_attempts`, `attempt_answers`, `questions`, `points_log`, `students`, `student_badges`, `student_achievements`, `reward_redemptions`).
- إضافة دالة SQL واحدة `student_gamification_stats(_student_id uuid)` (SECURITY DEFINER) تُعيد JSON بكل إحصائيات الـ Player Card في استعلام واحد لتفادي N+1 على الموبايل.
- إضافة دالة `exam_question_analytics(_exam_id uuid)` (SECURITY DEFINER، أدمن فقط) لتحليل الأسئلة.
- إضافة دالة `weekly_champions()` (SECURITY DEFINER، أدمن فقط) لكأس الأسبوع.
- الشهادة: مكتبة `qrcode` (خفيفة) داخل `src/lib/certificate.ts` مع تحميل lazy عبر `reports-lazy` لتفادي تضخيم الـ bundle.
- صفحة `/verify/$attemptId` عامة (RPC `get_certificate_verification` تعيد فقط: اسم الطالب، اسم الامتحان، النسبة، التاريخ).

### الملفات
**جديدة:**
- `src/routes/admin.exams.$id.analytics.tsx`
- `src/routes/verify.$attemptId.tsx`
- `src/lib/gamification-stats.functions.ts`
- `src/lib/exam-analytics.functions.ts`
- `src/lib/certificate.ts`
- migration واحد بالدوال الثلاث + GRANTs.

**تعديلات:**
- `src/routes/student.achievements.tsx` (إعادة تصميم كامل).
- `src/routes/student.exams.$id.result.tsx` (زر الشهادة).
- `src/routes/admin.exams.$id.results.tsx` (زر "تحليل الامتحان").
- `src/routes/admin.dashboard.tsx` أو `admin.leaderboard.tsx` (بطاقة كأس الأسبوع).

### التحقق النهائي
- بناء المشروع.
- اختبار يدوي عبر Playwright: فتح `/student/achievements`، فتح `/admin/exams/$id/analytics` لامتحان معتمد، توليد شهادة PDF ومسح QR إلى صفحة التحقق.

هل أبدأ التنفيذ؟