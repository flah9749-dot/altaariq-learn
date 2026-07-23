# خطة إعادة هيكلة نظام الذكاء الاصطناعي

## الهدف
تقليل استهلاك API والـ Tokens بشكل كبير مع الحفاظ على جميع الميزات وتجربة المستخدم.

## نظرة عامة على البنية الجديدة

```text
┌─────────────────────────────────────────────────┐
│  Client (UI)                                     │
│  - Debounce + منع الضغط المتكرر                  │
│  - Hash محلي للطلبات المتكررة                    │
└───────────────┬─────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────┐
│  AI Router (server)                              │
│  1. Task classifier (light/heavy)               │
│  2. Cache lookup (SHA256 of input+config)       │
│  3. Rate limiter (per user + global)            │
│  4. Model selector (task → model tier)          │
│  5. Provider fallback                           │
│  6. Usage logging (tokens, cost, latency)       │
└───────────────┬─────────────────────────────────┘
                │
      ┌─────────┴──────────┐
      ▼                    ▼
  Light tier          Heavy tier
  gemini-flash-lite   gemini-2.5-pro
  gpt-5.4-nano        gpt-5.5
```

## المكونات المطلوبة

### 1. جداول قاعدة البيانات الجديدة

**`ai_cache`** — تخزين نتائج الذكاء الاصطناعي القابلة لإعادة الاستخدام
- `id`, `cache_key` (SHA256), `task_type`, `input_hash`, `result` (jsonb), `model`, `tokens_in`, `tokens_out`, `hit_count`, `created_at`, `expires_at`
- فهرس على `cache_key` + RLS للأدمن + قراءة للـ service role

**`ai_extracted_documents`** — النصوص المستخرجة من الملفات (مرة واحدة)
- `id`, `source_hash` (SHA256 للملف), `file_name`, `mime_type`, `extracted_text`, `page_count`, `token_estimate`, `created_at`
- بديل لإعادة رفع الملف في كل طلب

**`ai_rate_limits`** — تتبع الاستهلاك اللحظي
- `user_id`, `window_start`, `request_count`, `token_count`

**تعديل `ai_usage_logs`** — إضافة أعمدة:
- `task_type`, `model_tier` (light/heavy), `cache_hit` (bool), `tokens_in`, `tokens_out`, `estimated_cost`

### 2. ملفات الكود

**`src/lib/ai/task-registry.server.ts`** (جديد)
تعريف مركزي لكل مهمة: النوع (light/heavy)، النموذج المفضل، الحد الأقصى للـ tokens، مدة الـ cache، هل يُخزَّن، إلخ.

```typescript
export const AI_TASKS = {
  student_assistant_chat: { tier: "light", cacheable: false, maxTokens: 1500 },
  student_assistant_file: { tier: "heavy", cacheable: true,  maxTokens: 4000, ttl: "7d" },
  admin_assistant_chat:   { tier: "light", cacheable: false, maxTokens: 1500 },
  exam_generate:          { tier: "heavy", cacheable: true,  maxTokens: 6000, ttl: "30d" },
  essay_grading:          { tier: "heavy", cacheable: true,  maxTokens: 800,  ttl: "30d" },
  map_analysis:           { tier: "heavy", cacheable: true,  maxTokens: 3000 },
  exam_analytics:         { tier: "light", cacheable: true,  maxTokens: 1200, ttl: "1h" },
  student_analytics:      { tier: "light", cacheable: true,  maxTokens: 1200, ttl: "1h" },
  summarize:              { tier: "light", cacheable: true,  maxTokens: 800 },
  paraphrase:             { tier: "light", cacheable: true,  maxTokens: 800 },
} as const;
```

**`src/lib/ai/router.server.ts`** (جديد)
الواجهة الموحدة لكل استدعاءات AI. يستبدل الاستدعاءات المباشرة لـ `callLovableChat`.

```typescript
export async function callAI(taskType, input, opts?) {
  1. compute cacheKey = sha256(taskType + input + model)
  2. if task.cacheable → لو موجود في ai_cache وغير منتهي → أعده
  3. rateLimit(userId, task.tier)
  4. model = pickModel(task.tier, opts.override, user's custom keys)
  5. reply = callProvider(model, input) [مع fallback chain داخل نفس الـ tier]
  6. if task.cacheable → احفظ في ai_cache
  7. log to ai_usage_logs (مع tokens_in/out من response.usage)
  8. return reply
}
```

**`src/lib/ai/document-cache.server.ts`** (جديد)
- `extractAndCacheDocument(dataUrl)`: يحسب hash، يبحث في `ai_extracted_documents`. لو موجود يرجع النص. لو لا، يستخرج بواسطة PDF.js (للـ PDF) أو استدعاء AI مرة واحدة للصور، ثم يحفظ.
- الطلبات اللاحقة على نفس الملف ترسل النص فقط بدلاً من الـ base64.

**`src/lib/ai/context-manager.server.ts`** (جديد)
- `trimHistory(messages, maxTokens)`: يحتفظ بآخر N رسالة + ملخص للأقدم.
- عند تجاوز 15 رسالة، يستدعي مرة واحدة تلخيصاً خفيفاً ويحفظه في العميل.

**`src/lib/ai/rate-limiter.server.ts`** (جديد)
- Sliding window: 20 طلب/دقيقة للطالب، 60/دقيقة للأدمن.
- منع نفس الطلب المتكرر خلال 3 ثوانٍ (in-memory + DB).

**`src/lib/ai-gateway.server.ts`** (تعديل)
- إضافة استخراج `usage` من رد الـ gateway وإرجاعه.
- تقليل model chain الافتراضي والاعتماد على tier من الـ router.

**`src/lib/ai-multi-provider.server.ts`** (تعديل)
- ربطه بـ router الجديد بدل الاستدعاءات المباشرة.

**استدعاءات موجودة يجب تحويلها للـ router:**
- `src/lib/ai-assistant.functions.ts` → `callAI("admin_assistant_chat", ...)` أو `admin_assistant_file`
- `src/lib/student-assistant.functions.ts` → `callAI("student_assistant_chat"/"file", ...)`
- `src/lib/ai-exam.functions.ts` → `exam_generate` + `essay_grading`
- `src/lib/ai-map.functions.ts` → `map_analysis`
- `analyzeExamResults` / `analyzeStudent` → cacheable analytics tasks

**تنظيف الـ Prompts:**
- تقصير `SYSTEM_PROMPT` في المساعدين (حالياً ~250 كلمة → ~80 كلمة).
- إزالة التكرار في `analyzeExamResults` / `analyzeStudent`.
- إرسال بيانات الطالب/الامتحان كـ JSON مضغوط بدل نصوص طويلة.

### 3. الواجهة الأمامية

**`src/hooks/use-ai-request.ts`** (جديد)
- Hook موحد للاستدعاء مع debounce (500ms) وإلغاء الطلبات المكررة (AbortController) و in-flight guard.

**`src/components/admin/AiInsightsCard.tsx`** (تعديل خفيف)
- تعطيل الزر أثناء الطلب (موجود) + تحذير عند إعادة توليد "سيستخدم النتيجة المحفوظة".

**`src/components/assistant/*`** (تعديل)
- تطبيق `useAiRequest` بدل mutation مباشرة.

### 4. صفحة المراقبة

**`src/routes/admin.ai.tsx`** (تعديل)
- إضافة تبويب "الاستهلاك والتكلفة":
  - رسم بياني (آخر 7/30 يوم): طلبات، tokens in/out، cache hit rate.
  - أعلى 10 مهام استهلاكاً.
  - أعلى 10 مستخدمين.
  - متوسط زمن الاستجابة لكل مزود.
  - تكلفة تقديرية (جدول أسعار داخل الكود لكل نموذج).
- زر "تفريغ Cache" (للأدمن).

### 5. المهام البرمجية بدلاً من AI

مراجعة سريعة والتأكد من:
- تصحيح MCQ / true-false: برمجي فقط ✅ (بالفعل كذلك في `submitAttempt`).
- حساب الدرجات والإحصائيات: برمجي ✅.
- الفلاتر والبحث: برمجي ✅.
- إعادة صياغة "تلقائية": فقط عند طلب المستخدم صراحة.

## خطة التنفيذ (بالترتيب)

1. **Migration**: إنشاء الجداول الثلاثة الجديدة + الأعمدة الإضافية على `ai_usage_logs` مع GRANT + RLS.
2. **Core layer**: `task-registry`, `router`, `document-cache`, `context-manager`, `rate-limiter`.
3. **تعديل `ai-gateway.server.ts`** لإرجاع `usage`.
4. **تحويل جميع نقاط الاستدعاء** لاستخدام `callAI(taskType, ...)`.
5. **تقصير الـ Prompts** في المساعدين والتحليلات.
6. **Hook `use-ai-request`** + تطبيقه في المساعدين.
7. **تبويب المراقبة الجديد** في `/admin/ai`.
8. **اختبار سريع** لكل مسار (مساعد طالب/معلم، توليد امتحان، تحليل، خريطة).

## الأثر المتوقع

| البند | قبل | بعد |
|---|---|---|
| نموذج المساعد اليومي | gemini-2.5-pro | gemini-3.1-flash-lite |
| رفع نفس PDF مرتين | 2× base64 | نص مستخرج مرة |
| تحليل نفس امتحان | كل مرة | Cache ساعة |
| System prompt | ~250 كلمة | ~80 كلمة |
| History مفتوح | كل الرسائل | آخر 8 + ملخص |
| Cache hit عام متوقع | 0% | 30-50% |

**التقدير**: خفض الاستهلاك 50-70% للحمل النموذجي دون فقدان ميزات.

## ملاحظات

- كل النتائج المخزنة في `ai_cache` تُعرض هوية "من Cache" للأدمن في المراقبة.
- المفاتيح المخصصة (نظام `ai_api_keys` الحالي) تبقى تعمل كما هي — يستخدمها الـ router عند اختيار المزود.
- لا حذف لأي endpoint أو ميزة. فقط تحويل قناة الاستدعاء + طبقة تحسين.
