
-- 1) Player card / gamification stats for a student
CREATE OR REPLACE FUNCTION public.student_gamification_stats(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_class uuid;
  v_points int;
  v_level int;
  v_full text;
  v_avatar text;
  v_exam_count int := 0;
  v_answers_total int := 0;
  v_answers_correct int := 0;
  v_map_answers int := 0;
  v_badges int := 0;
  v_achievements int := 0;
  v_rewards int := 0;
  v_class_size int := 0;
  v_class_rank int := 0;
  v_last_percents numeric[];
  v_current_level_min int := 0;
  v_next_level_min int := NULL;
  v_next_level_name text := NULL;
BEGIN
  SELECT s.user_id, s.class_id, s.points, s.level, s.full_name, s.avatar_url
    INTO v_owner, v_class, v_points, v_level, v_full, v_avatar
  FROM public.students s WHERE s.id = _student_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF auth.uid() IS NOT NULL AND v_owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO v_exam_count
    FROM public.exam_attempts WHERE student_id = _student_id AND submitted_at IS NOT NULL;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_correct = true), COUNT(*) FILTER (WHERE q.type = 'map')
    INTO v_answers_total, v_answers_correct, v_map_answers
  FROM public.attempt_answers a
  JOIN public.exam_attempts ea ON ea.id = a.attempt_id
  LEFT JOIN public.questions q ON q.id = a.question_id
  WHERE ea.student_id = _student_id AND ea.submitted_at IS NOT NULL;

  SELECT COUNT(*) INTO v_badges FROM public.student_badges WHERE student_id = _student_id;
  SELECT COUNT(*) INTO v_achievements FROM public.student_achievements WHERE student_id = _student_id;
  SELECT COUNT(*) INTO v_rewards FROM public.reward_redemptions WHERE student_id = _student_id;

  -- rank in class by points
  IF v_class IS NOT NULL THEN
    SELECT COUNT(*) INTO v_class_size FROM public.students WHERE class_id = v_class AND archived_at IS NULL;
    SELECT COUNT(*) + 1 INTO v_class_rank
      FROM public.students
      WHERE class_id = v_class AND archived_at IS NULL AND COALESCE(points,0) > COALESCE(v_points,0);
  END IF;

  -- last 6 percentages
  SELECT COALESCE(array_agg(x ORDER BY t), '{}')
    INTO v_last_percents
  FROM (
    SELECT percentage AS x, submitted_at AS t
    FROM public.exam_attempts
    WHERE student_id = _student_id AND submitted_at IS NOT NULL
    ORDER BY submitted_at DESC LIMIT 6
  ) s;

  -- level bounds
  SELECT COALESCE(MAX(min_points), 0) INTO v_current_level_min
    FROM public.levels WHERE active = true AND min_points <= COALESCE(v_points, 0);
  SELECT min_points, name INTO v_next_level_min, v_next_level_name
    FROM public.levels WHERE active = true AND min_points > COALESCE(v_points, 0)
    ORDER BY min_points ASC LIMIT 1;

  RETURN jsonb_build_object(
    'student_id', _student_id,
    'full_name', v_full,
    'avatar_url', v_avatar,
    'points', COALESCE(v_points, 0),
    'level', COALESCE(v_level, 1),
    'current_level_min', v_current_level_min,
    'next_level_min', v_next_level_min,
    'next_level_name', v_next_level_name,
    'exam_count', v_exam_count,
    'answers_total', v_answers_total,
    'answers_correct', v_answers_correct,
    'map_answers', v_map_answers,
    'badges', v_badges,
    'achievements', v_achievements,
    'rewards', v_rewards,
    'class_size', v_class_size,
    'class_rank', v_class_rank,
    'last_percents', to_jsonb(v_last_percents)
  );
END; $$;

-- 2) Exam question analytics (admin only)
CREATE OR REPLACE FUNCTION public.exam_question_analytics(_exam_id uuid)
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

  SELECT jsonb_build_object(
    'questions', COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.order_index), '[]'::jsonb)
  ) INTO result
  FROM (
    SELECT
      q.id, q.text, q.type, q.order_index, q.points, q.difficulty,
      COALESCE(cnt.total, 0)::int AS attempts_count,
      COALESCE(cnt.correct, 0)::int AS correct_count,
      COALESCE(cnt.wrong, 0)::int AS wrong_count,
      CASE WHEN COALESCE(cnt.total,0) > 0
        THEN ROUND((cnt.correct::numeric / cnt.total) * 100, 1)
        ELSE NULL END AS correct_rate,
      CASE
        WHEN COALESCE(cnt.total,0) = 0 THEN 'unknown'
        WHEN (cnt.correct::numeric / cnt.total) >= 0.75 THEN 'easy'
        WHEN (cnt.correct::numeric / cnt.total) >= 0.40 THEN 'medium'
        ELSE 'hard'
      END AS auto_difficulty
    FROM public.questions q
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE a.is_correct = true) AS correct,
        COUNT(*) FILTER (WHERE a.is_correct = false) AS wrong
      FROM public.attempt_answers a
      JOIN public.exam_attempts ea ON ea.id = a.attempt_id
      WHERE a.question_id = q.id AND ea.submitted_at IS NOT NULL
    ) cnt ON true
    WHERE q.exam_id = _exam_id
  ) x;

  RETURN result;
END; $$;

-- 3) Weekly champions (admin only)
CREATE OR REPLACE FUNCTION public.weekly_champions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top_student jsonb;
  v_top_class jsonb;
  v_top_group jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT to_jsonb(x) INTO v_top_student FROM (
    SELECT s.id, s.full_name, s.avatar_url, SUM(pl.points)::int AS week_points
    FROM public.points_log pl
    JOIN public.students s ON s.id = pl.student_id
    WHERE pl.created_at >= now() - interval '7 days' AND pl.points > 0
    GROUP BY s.id, s.full_name, s.avatar_url
    ORDER BY SUM(pl.points) DESC LIMIT 1
  ) x;

  SELECT to_jsonb(x) INTO v_top_class FROM (
    SELECT c.id, c.name, ROUND(AVG(ea.percentage)::numeric, 1) AS avg_pct, COUNT(*)::int AS attempts
    FROM public.exam_attempts ea
    JOIN public.students s ON s.id = ea.student_id
    JOIN public.classes c ON c.id = s.class_id
    WHERE ea.submitted_at >= now() - interval '7 days'
    GROUP BY c.id, c.name
    HAVING COUNT(*) >= 3
    ORDER BY AVG(ea.percentage) DESC LIMIT 1
  ) x;

  SELECT to_jsonb(x) INTO v_top_group FROM (
    SELECT g.id, g.name, c.name AS class_name,
           ROUND(AVG(ea.percentage)::numeric, 1) AS avg_pct, COUNT(*)::int AS attempts
    FROM public.exam_attempts ea
    JOIN public.students s ON s.id = ea.student_id
    JOIN public.groups g ON g.id = s.group_id
    LEFT JOIN public.classes c ON c.id = g.class_id
    WHERE ea.submitted_at >= now() - interval '7 days'
    GROUP BY g.id, g.name, c.name
    HAVING COUNT(*) >= 3
    ORDER BY AVG(ea.percentage) DESC LIMIT 1
  ) x;

  RETURN jsonb_build_object(
    'top_student', v_top_student,
    'top_class', v_top_class,
    'top_group', v_top_group,
    'week_start', (now() - interval '7 days')::date
  );
END; $$;

-- 4) Public certificate verification
CREATE OR REPLACE FUNCTION public.get_certificate_verification(_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'attempt_id', ea.id,
    'student_name', s.full_name,
    'exam_title', e.title,
    'percentage', ea.percentage,
    'score', ea.score,
    'total', ea.total,
    'grade', ea.grade,
    'submitted_at', ea.submitted_at,
    'approved', ea.approved,
    'valid', ea.submitted_at IS NOT NULL
  ) INTO result
  FROM public.exam_attempts ea
  JOIN public.students s ON s.id = ea.student_id
  JOIN public.exams e ON e.id = ea.exam_id
  WHERE ea.id = _attempt_id AND ea.submitted_at IS NOT NULL;

  IF result IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;
  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.student_gamification_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exam_question_analytics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_champions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_certificate_verification(uuid) TO anon, authenticated;
