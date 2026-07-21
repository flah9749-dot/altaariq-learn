
-- Extend ai_providers with stats and testing fields
ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS test_status text,
  ADD COLUMN IF NOT EXISTS test_error text,
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS requests_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS errors_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_latency_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS secret_name text,
  ADD COLUMN IF NOT EXISTS default_model text;

-- Seed 7 providers (idempotent)
INSERT INTO public.ai_providers (slug, name, enabled, priority, secret_name, default_model) VALUES
  ('gemini','Google Gemini', false, 1, 'GEMINI_API_KEY', 'gemini-2.0-flash-exp'),
  ('openai','OpenAI', false, 2, 'OPENAI_API_KEY', 'gpt-4o-mini'),
  ('claude','Anthropic Claude', false, 3, 'ANTHROPIC_API_KEY', 'claude-3-5-sonnet-20241022'),
  ('groq','Groq', false, 4, 'GROQ_API_KEY', 'llama-3.3-70b-versatile'),
  ('deepseek','DeepSeek', false, 5, 'DEEPSEEK_API_KEY', 'deepseek-chat'),
  ('mistral','Mistral', false, 6, 'MISTRAL_API_KEY', 'mistral-small-latest'),
  ('openrouter','OpenRouter', false, 7, 'OPENROUTER_API_KEY', 'openai/gpt-4o-mini')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  secret_name = EXCLUDED.secret_name,
  default_model = COALESCE(public.ai_providers.default_model, EXCLUDED.default_model);

-- Function → Provider mapping
CREATE TABLE IF NOT EXISTS public.ai_function_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_key text UNIQUE NOT NULL,
  function_name text NOT NULL,
  category text NOT NULL,
  provider_slug text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_function_mapping TO authenticated;
GRANT ALL ON public.ai_function_mapping TO service_role;
ALTER TABLE public.ai_function_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_mapping" ON public.ai_function_mapping;
CREATE POLICY "admins_manage_mapping" ON public.ai_function_mapping
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth_read_mapping" ON public.ai_function_mapping;
CREATE POLICY "auth_read_mapping" ON public.ai_function_mapping
  FOR SELECT TO authenticated USING (true);

-- Seed default mappings
INSERT INTO public.ai_function_mapping (function_key, function_name, category, provider_slug) VALUES
  ('exam_generation','توليد الامتحانات','محتوى','gemini'),
  ('pdf_extraction','استخراج الأسئلة من PDF','محتوى','gemini'),
  ('ocr','استخراج النصوص من الصور (OCR)','محتوى','gemini'),
  ('homework_creation','إنشاء الواجبات','محتوى','gemini'),
  ('summary_creation','إنشاء الملخصات','محتوى','gemini'),
  ('revision_creation','إنشاء المراجعات','محتوى','gemini'),
  ('competition_creation','إنشاء مسابقات','محتوى','gemini'),
  ('question_bank','إنشاء بنك الأسئلة','محتوى','gemini'),
  ('essay_grading','التصحيح المقالي','تحليل','openai'),
  ('student_analysis','تحليل أداء الطالب','تحليل','openai'),
  ('class_analysis','تحليل نتائج الصف','تحليل','openai'),
  ('review_plan','اقتراح خطة مراجعة','تحليل','openai'),
  ('teacher_assistant','مساعد المدرس الذكي','دردشة','openai'),
  ('admin_chat','Chat داخل لوحة الأدمن','دردشة','openai'),
  ('student_chat','Chat الطالب','دردشة','openai'),
  ('quick_replies','الردود السريعة','سريع','groq'),
  ('rephrase','إعادة الصياغة','سريع','groq'),
  ('translate','الترجمة','سريع','groq')
ON CONFLICT (function_key) DO NOTHING;

-- Ensure ai_usage_logs has latency
ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS function_key text;
