
-- Roll back SECURITY DEFINER views from previous attempt
DROP VIEW IF EXISTS public.student_questions;
DROP VIEW IF EXISTS public.student_question_options;

-- Re-establish student row-level access (columns will be constrained separately)
CREATE POLICY "Students read published questions" ON public.questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exams e WHERE e.id = questions.exam_id AND e.published = true
  ));

CREATE POLICY "Students read options" ON public.question_options
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questions q
    JOIN public.exams e ON e.id = q.exam_id
    WHERE q.id = question_options.question_id AND e.published = true
  ));

-- Column-level lockdown of answer keys
REVOKE SELECT (correct_answer) ON public.questions FROM authenticated;
REVOKE SELECT (correct_answer) ON public.questions FROM anon;
REVOKE SELECT (is_correct)     ON public.question_options FROM authenticated;
REVOKE SELECT (is_correct)     ON public.question_options FROM anon;

-- Admin-only accessor for question authoring/editing (returns everything)
CREATE OR REPLACE FUNCTION public.admin_get_exam_questions(_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.order_index), '[]'::jsonb) INTO result
  FROM (
    SELECT q.*,
      (SELECT COALESCE(jsonb_agg(row_to_json(o) ORDER BY o.order_index), '[]'::jsonb)
       FROM public.question_options o WHERE o.question_id = q.id) AS question_options
    FROM public.questions q WHERE q.exam_id = _exam_id
  ) x;
  RETURN result;
END; $$;

REVOKE ALL ON FUNCTION public.admin_get_exam_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_exam_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_exam_questions(uuid) TO authenticated;

-- Post-submission review accessor: student can only see own attempt after submission
CREATE OR REPLACE FUNCTION public.get_attempt_review(_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin bool := public.has_role(auth.uid(), 'admin'::app_role);
  v_owner_uid uuid;
  v_submitted timestamptz;
  v_result jsonb;
BEGIN
  SELECT s.user_id, ea.submitted_at
    INTO v_owner_uid, v_submitted
  FROM public.exam_attempts ea
  JOIN public.students s ON s.id = ea.student_id
  WHERE ea.id = _attempt_id;

  IF v_owner_uid IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;

  IF NOT v_is_admin THEN
    IF v_owner_uid <> auth.uid() THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    IF v_submitted IS NULL THEN
      RAISE EXCEPTION 'Attempt not yet submitted';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_result
  FROM (
    SELECT a.*,
      jsonb_build_object(
        'id', q.id, 'text', q.text, 'type', q.type, 'points', q.points,
        'explanation', q.explanation, 'correct_answer', q.correct_answer,
        'question_options', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', o.id, 'text', o.text, 'is_correct', o.is_correct,
            'order_index', o.order_index
          ) ORDER BY o.order_index), '[]'::jsonb)
          FROM public.question_options o WHERE o.question_id = q.id
        )
      ) AS questions
    FROM public.attempt_answers a
    JOIN public.questions q ON q.id = a.question_id
    WHERE a.attempt_id = _attempt_id
  ) x;
  RETURN v_result;
END; $$;

REVOKE ALL ON FUNCTION public.get_attempt_review(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_attempt_review(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_review(uuid) TO authenticated;
