CREATE TABLE public.student_credentials (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.student_credentials TO service_role;

ALTER TABLE public.student_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.student_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_student_credentials_updated_at
  BEFORE UPDATE ON public.student_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();