CREATE OR REPLACE FUNCTION public.get_attempt_review(_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        'id', q.id,
        'text', q.text,
        'type', q.type,
        'points', q.points,
        'image_url', q.image_url,
        'file_url', q.file_url,
        'explanation', q.explanation,
        'correct_answer', q.correct_answer,
        'question_options', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', o.id, 'text', o.text, 'is_correct', o.is_correct,
            'order_index', o.order_index, 'image_url', o.image_url
          ) ORDER BY o.order_index), '[]'::jsonb)
          FROM public.question_options o WHERE o.question_id = q.id
        )
      ) AS questions
    FROM public.attempt_answers a
    JOIN public.questions q ON q.id = a.question_id
    WHERE a.attempt_id = _attempt_id
  ) x;
  RETURN v_result;
END;
$function$;