
-- 1) ai_cache: نتائج AI القابلة لإعادة الاستخدام
CREATE TABLE IF NOT EXISTS public.ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  task_type text NOT NULL,
  model text,
  provider text,
  result jsonb NOT NULL,
  tokens_in integer DEFAULT 0,
  tokens_out integer DEFAULT 0,
  hit_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz,
  expires_at timestamptz
);
GRANT SELECT ON public.ai_cache TO authenticated;
GRANT ALL ON public.ai_cache TO service_role;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ai_cache" ON public.ai_cache FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_ai_cache_task ON public.ai_cache(task_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON public.ai_cache(expires_at) WHERE expires_at IS NOT NULL;

-- 2) ai_extracted_documents: النصوص المستخرجة من الملفات (مرة واحدة)
CREATE TABLE IF NOT EXISTS public.ai_extracted_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash text NOT NULL UNIQUE,
  file_name text,
  mime_type text,
  extracted_text text NOT NULL,
  page_count integer,
  char_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
GRANT SELECT ON public.ai_extracted_documents TO authenticated;
GRANT ALL ON public.ai_extracted_documents TO service_role;
ALTER TABLE public.ai_extracted_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read documents" ON public.ai_extracted_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

-- 3) ai_rate_limits: تتبع الاستهلاك اللحظي
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  token_count integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, window_start)
);
GRANT SELECT ON public.ai_rate_limits TO authenticated;
GRANT ALL ON public.ai_rate_limits TO service_role;
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read rate limits" ON public.ai_rate_limits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_ai_rate_user_window ON public.ai_rate_limits(user_id, window_start DESC);

-- 4) توسعة ai_usage_logs
ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS task_type text,
  ADD COLUMN IF NOT EXISTS model_tier text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tokens_in integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_out integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(10,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_ai_usage_task ON public.ai_usage_logs(task_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage_logs(created_at DESC);
