
-- 1) join_codes
CREATE TABLE public.join_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.join_codes TO authenticated;
GRANT ALL ON public.join_codes TO service_role;
ALTER TABLE public.join_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage join_codes" ON public.join_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_join_codes_updated_at BEFORE UPDATE ON public.join_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_join_codes_active ON public.join_codes(active) WHERE active = true;

-- 2) registration_requests
CREATE TABLE public.registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.join_codes(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  student_phone text NOT NULL,
  parent_phone text NOT NULL,
  parent_name text,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE RESTRICT,
  avatar_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','auto_approved')),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  reject_reason text,
  ip_address text,
  user_agent text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_requests TO authenticated;
GRANT ALL ON public.registration_requests TO service_role;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage registration_requests" ON public.registration_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_reg_requests_status ON public.registration_requests(status);
CREATE INDEX idx_reg_requests_created ON public.registration_requests(created_at DESC);
CREATE INDEX idx_reg_requests_phone ON public.registration_requests(student_phone);
CREATE INDEX idx_reg_requests_ip_time ON public.registration_requests(ip_address, created_at);

-- 3) Validation function (no auth required)
CREATE OR REPLACE FUNCTION public.validate_join_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  code_norm text := upper(trim(_code));
BEGIN
  SELECT jc.id, jc.class_id, jc.group_id, jc.active, jc.expires_at, jc.max_uses, jc.used_count,
         c.name AS class_name, g.name AS group_name
    INTO r
    FROM public.join_codes jc
    JOIN public.classes c ON c.id = jc.class_id
    JOIN public.groups g ON g.id = jc.group_id
   WHERE upper(jc.code) = code_norm;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'كود غير صحيح');
  END IF;
  IF NOT r.active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'الكود معطّل');
  END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'انتهت صلاحية الكود');
  END IF;
  IF r.max_uses IS NOT NULL AND r.used_count >= r.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'وصل الكود للحد الأقصى للاستخدام');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code_id', r.id,
    'class_id', r.class_id,
    'group_id', r.group_id,
    'class_name', r.class_name,
    'group_name', r.group_name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_join_code(text) TO anon, authenticated;

-- 4) Increment usage (service role only)
CREATE OR REPLACE FUNCTION public.increment_join_code_use(_code_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.join_codes SET used_count = used_count + 1, updated_at = now() WHERE id = _code_id;
$$;
REVOKE ALL ON FUNCTION public.increment_join_code_use(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_join_code_use(uuid) TO service_role;

-- 5) Settings
INSERT INTO public.settings(key, value) VALUES
  ('self_registration.enabled', 'true'::jsonb),
  ('self_registration.auto_approve', 'true'::jsonb),
  ('self_registration.send_to_student_phone', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
