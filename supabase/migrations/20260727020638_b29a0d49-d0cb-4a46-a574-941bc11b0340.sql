
-- 1) Drop leaky student policies on questions & question_options
DROP POLICY IF EXISTS "Students read published questions" ON public.questions;
DROP POLICY IF EXISTS "Students read options" ON public.question_options;

-- 2) Drop broad authenticated read on question-bank storage bucket
DROP POLICY IF EXISTS "Authenticated read question-bank objects" ON storage.objects;

-- 3) Helper: sanitize map correct_answer (strip labels/answers/is_correct from sub-questions)
CREATE OR REPLACE FUNCTION public._sanitize_map_correct(_ca jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _ca IS NULL OR NOT (_ca ? 'points') THEN NULL
    ELSE jsonb_build_object(
      'points',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'x', p->'x',
            'y', p->'y',
            'questions', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', sq->'id',
                  'text', sq->'text',
                  'type', sq->'type',
                  'points', sq->'points',
                  'options', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('text', o->'text'))
                    FROM jsonb_array_elements(COALESCE(sq->'options', '[]'::jsonb)) o
                  ), '[]'::jsonb)
                )
              )
              FROM jsonb_array_elements(COALESCE(p->'questions', '[]'::jsonb)) sq
            ), '[]'::jsonb)
          )
        )
        FROM jsonb_array_elements(_ca->'points') p
      ), '[]'::jsonb)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public._sanitize_map_correct(jsonb) FROM PUBLIC, anon, authenticated;

-- 4) SECURITY DEFINER RPC to serve exam questions to students during taking,
--    without leaking correct answers.
CREATE OR REPLACE FUNCTION public.get_take_exam_questions(_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_published bool;
  v_is_admin  bool := public.has_role(auth.uid(), 'admin'::app_role);
  v_result    jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT published INTO v_published FROM public.exams WHERE id = _exam_id;
  IF v_published IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;
  IF NOT v_is_admin AND NOT v_published THEN
    RAISE EXCEPTION 'Exam not available';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.order_index), '[]'::jsonb) INTO v_result
  FROM (
    SELECT
      q.id,
      q.exam_id,
      q.text,
      q.type,
      q.points,
      q.order_index,
      q.image_url,
      q.difficulty,
      q.suggested_time_sec,
      CASE
        WHEN q.type = 'map' THEN public._sanitize_map_correct(q.correct_answer)
        ELSE NULL
      END AS correct_answer,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'text', o.text,
            'image_url', o.image_url,
            'order_index', o.order_index,
            'match_key', CASE WHEN q.type = 'match' THEN o.match_key ELSE NULL END
          )
          ORDER BY o.order_index
        ), '[]'::jsonb)
        FROM public.question_options o
        WHERE o.question_id = q.id
      ) AS question_options
    FROM public.questions q
    WHERE q.exam_id = _exam_id
  ) x;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_take_exam_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_take_exam_questions(uuid) TO authenticated;
