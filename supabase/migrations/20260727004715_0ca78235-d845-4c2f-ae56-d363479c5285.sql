
CREATE OR REPLACE FUNCTION public.admin_students_overview(
  _class_id uuid DEFAULT NULL,
  _group_id uuid DEFAULT NULL,
  _status text DEFAULT NULL
) RETURNS TABLE(
  id uuid,
  code text,
  full_name text,
  avatar_url text,
  phone text,
  parent_name text,
  parent_phone text,
  parent_whatsapp text,
  status text,
  class_id uuid,
  class_name text,
  group_id uuid,
  group_name text,
  points integer,
  level integer,
  last_seen timestamptz,
  created_at timestamptz,
  scheduled_count integer,
  attended_count integer,
  absent_count integer,
  last_exam_id uuid,
  last_exam_title text,
  last_exam_attended boolean,
  last_exam_percentage numeric,
  avg_percentage numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT st.*
    FROM public.students st
    WHERE st.archived_at IS NULL
      AND (_class_id IS NULL OR st.class_id = _class_id)
      AND (_group_id IS NULL OR st.group_id = _group_id)
      AND (_status IS NULL OR st.status = _status)
  ),
  sched AS (
    SELECT s.id AS student_id, COUNT(DISTINCT e.id)::int AS scheduled_count
    FROM s
    LEFT JOIN public.exams e
      ON e.published = true
     AND (e.class_id IS NULL OR e.class_id = s.class_id)
     AND (COALESCE(array_length(e.group_ids, 1), 0) = 0 OR s.group_id = ANY(e.group_ids))
     AND (e.starts_at IS NULL OR e.starts_at <= now())
    GROUP BY s.id
  ),
  att AS (
    SELECT ea.student_id,
      COUNT(*)::int AS attended_count,
      ROUND(AVG(ea.percentage)::numeric, 1) AS avg_percentage
    FROM public.exam_attempts ea
    WHERE ea.student_id IN (SELECT s.id FROM s)
      AND ea.submitted_at IS NOT NULL
    GROUP BY ea.student_id
  ),
  last_ex AS (
    SELECT DISTINCT ON (s.id)
      s.id AS student_id,
      e.id AS exam_id,
      e.title AS title,
      (ea.submitted_at IS NOT NULL) AS attended,
      ea.percentage AS percentage
    FROM s
    JOIN public.exams e
      ON e.published = true
     AND (e.class_id IS NULL OR e.class_id = s.class_id)
     AND (COALESCE(array_length(e.group_ids, 1), 0) = 0 OR s.group_id = ANY(e.group_ids))
     AND (e.starts_at IS NULL OR e.starts_at <= now())
    LEFT JOIN public.exam_attempts ea
      ON ea.student_id = s.id AND ea.exam_id = e.id
    ORDER BY s.id, COALESCE(e.starts_at, e.created_at) DESC NULLS LAST
  )
  SELECT
    s.id,
    s.code,
    s.full_name,
    s.avatar_url,
    s.phone,
    s.parent_name,
    s.parent_phone,
    s.parent_whatsapp,
    s.status,
    s.class_id,
    c.name AS class_name,
    s.group_id,
    g.name AS group_name,
    s.points,
    s.level,
    s.last_seen,
    s.created_at,
    COALESCE(sc.scheduled_count, 0) AS scheduled_count,
    COALESCE(a.attended_count, 0) AS attended_count,
    GREATEST(COALESCE(sc.scheduled_count, 0) - COALESCE(a.attended_count, 0), 0) AS absent_count,
    le.exam_id AS last_exam_id,
    le.title AS last_exam_title,
    COALESCE(le.attended, false) AS last_exam_attended,
    le.percentage AS last_exam_percentage,
    COALESCE(a.avg_percentage, 0) AS avg_percentage
  FROM s
  LEFT JOIN public.classes c ON c.id = s.class_id
  LEFT JOIN public.groups g  ON g.id = s.group_id
  LEFT JOIN sched sc         ON sc.student_id = s.id
  LEFT JOIN att a            ON a.student_id = s.id
  LEFT JOIN last_ex le       ON le.student_id = s.id;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_students_overview(uuid, uuid, text) TO authenticated;
