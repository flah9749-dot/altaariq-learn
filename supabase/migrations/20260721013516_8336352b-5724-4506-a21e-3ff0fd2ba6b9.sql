
-- Remove student direct SELECT on answer-bearing columns; expose safe views instead.
DROP POLICY IF EXISTS "Students read published questions" ON public.questions;
DROP POLICY IF EXISTS "Students read options" ON public.question_options;

-- Safe view for students: excludes correct_answer (and explanation, which is post-grading content)
CREATE OR REPLACE VIEW public.student_questions
WITH (security_invoker = off) AS
SELECT q.id, q.exam_id, q.type, q.text, q.image_url, q.file_url,
       q.points, q.suggested_time_sec, q.order_index, q.difficulty,
       q.created_at, q.updated_at
FROM public.questions q
WHERE EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = q.exam_id AND e.published = true
);

-- Safe view for options: excludes is_correct
CREATE OR REPLACE VIEW public.student_question_options
WITH (security_invoker = off) AS
SELECT o.id, o.question_id, o.text, o.image_url, o.order_index, o.match_key
FROM public.question_options o
WHERE EXISTS (
  SELECT 1 FROM public.questions q
  JOIN public.exams e ON e.id = q.exam_id
  WHERE q.id = o.question_id AND e.published = true
);

REVOKE ALL ON public.student_questions FROM PUBLIC, anon;
REVOKE ALL ON public.student_question_options FROM PUBLIC, anon;
GRANT SELECT ON public.student_questions TO authenticated;
GRANT SELECT ON public.student_question_options TO authenticated;
