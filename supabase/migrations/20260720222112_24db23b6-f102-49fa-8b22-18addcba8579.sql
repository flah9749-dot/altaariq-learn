
-- Extend exams
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_minutes int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS attempts_allowed int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS show_result_mode text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS shuffle_questions bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shuffle_options bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS num_variants int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS anti_cheat jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_exams_updated_at') THEN
    CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Questions
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  type text NOT NULL,
  text text NOT NULL,
  image_url text,
  file_url text,
  points numeric NOT NULL DEFAULT 1,
  suggested_time_sec int,
  explanation text,
  order_index int NOT NULL DEFAULT 0,
  correct_answer jsonb,
  difficulty text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students read published questions" ON public.questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.published = true));
CREATE INDEX IF NOT EXISTS questions_exam_idx ON public.questions(exam_id, order_index);
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Question options
CREATE TABLE IF NOT EXISTS public.question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  image_url text,
  is_correct bool NOT NULL DEFAULT false,
  order_index int NOT NULL DEFAULT 0,
  match_key text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_options TO authenticated;
GRANT ALL ON public.question_options TO service_role;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage options" ON public.question_options FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students read options" ON public.question_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.questions q JOIN public.exams e ON e.id=q.exam_id WHERE q.id = question_id AND e.published = true));
CREATE INDEX IF NOT EXISTS question_options_q_idx ON public.question_options(question_id, order_index);

-- Exam attempts
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  time_spent_sec int NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  percentage numeric NOT NULL DEFAULT 0,
  grade text,
  status text NOT NULL DEFAULT 'in_progress',
  needs_review bool NOT NULL DEFAULT false,
  leave_events int NOT NULL DEFAULT 0,
  ip text,
  user_agent text,
  device_info jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_attempts TO authenticated;
GRANT ALL ON public.exam_attempts TO service_role;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read all attempts" ON public.exam_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update attempts" ON public.exam_attempts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete attempts" ON public.exam_attempts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Students see own attempts" ON public.exam_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Students create own attempts" ON public.exam_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Students update own attempts" ON public.exam_attempts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS exam_attempts_exam_idx ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS exam_attempts_student_idx ON public.exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS exam_attempts_user_idx ON public.exam_attempts(user_id);
CREATE TRIGGER update_exam_attempts_updated_at BEFORE UPDATE ON public.exam_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attempt answers
CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer jsonb,
  is_correct bool,
  awarded_points numeric,
  time_spent_sec int NOT NULL DEFAULT 0,
  ai_reasoning text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempt_answers TO authenticated;
GRANT ALL ON public.attempt_answers TO service_role;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage answers" ON public.attempt_answers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Students manage own answers" ON public.attempt_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.id=attempt_id AND a.user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.id=attempt_id AND a.user_id=auth.uid()));
CREATE TRIGGER update_attempt_answers_updated_at BEFORE UPDATE ON public.attempt_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_attempts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
