
-- 1. AI Quota Policies (default per role/feature)
CREATE TABLE public.ai_quota_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','student')),
  feature TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily','weekly','monthly')),
  limit_count INTEGER NOT NULL DEFAULT 20,
  max_file_mb INTEGER,
  max_pages INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, feature)
);
GRANT SELECT ON public.ai_quota_policies TO authenticated;
GRANT ALL ON public.ai_quota_policies TO service_role;
ALTER TABLE public.ai_quota_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read policies" ON public.ai_quota_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage policies" ON public.ai_quota_policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_ai_quota_policies_updated BEFORE UPDATE ON public.ai_quota_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Per-user overrides
CREATE TABLE public.ai_quota_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  period TEXT CHECK (period IN ('daily','weekly','monthly')),
  limit_count INTEGER,
  unlimited BOOLEAN NOT NULL DEFAULT false,
  max_file_mb INTEGER,
  max_pages INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature)
);
GRANT SELECT ON public.ai_quota_overrides TO authenticated;
GRANT ALL ON public.ai_quota_overrides TO service_role;
ALTER TABLE public.ai_quota_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own override" ON public.ai_quota_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin manage overrides" ON public.ai_quota_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_ai_quota_overrides_updated BEFORE UPDATE ON public.ai_quota_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Usage counter
CREATE TABLE public.ai_quota_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  period_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature, period_key)
);
GRANT SELECT ON public.ai_quota_usage TO authenticated;
GRANT ALL ON public.ai_quota_usage TO service_role;
ALTER TABLE public.ai_quota_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own usage" ON public.ai_quota_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin manage usage" ON public.ai_quota_usage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE INDEX ai_quota_usage_period_idx ON public.ai_quota_usage (feature, period_key);

-- 4. Extend ai_usage_logs
ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS feature TEXT,
  ADD COLUMN IF NOT EXISTS charged BOOLEAN NOT NULL DEFAULT false;

-- 5. Seed default policies
INSERT INTO public.ai_quota_policies (role, feature, period, limit_count, max_file_mb, max_pages) VALUES
  ('student','assistant_message','daily',30,NULL,NULL),
  ('student','file_upload','daily',5,20,50),
  ('student','summary','daily',10,NULL,NULL),
  ('student','lesson_explain','daily',15,NULL,NULL),
  ('student','map_analysis','daily',10,10,NULL),
  ('admin','assistant_message','daily',200,NULL,NULL),
  ('admin','file_upload','daily',50,50,200),
  ('admin','exam_generation','daily',30,50,200),
  ('admin','essay_grading','daily',200,NULL,NULL),
  ('admin','content_plan','daily',30,NULL,NULL),
  ('admin','map_analysis','daily',50,20,NULL)
ON CONFLICT (role, feature) DO NOTHING;
