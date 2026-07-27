
CREATE OR REPLACE FUNCTION public.admin_tree_classes_overview()
 RETURNS TABLE(class_id uuid, class_name text, students_count integer, active_count integer, avg_percentage numeric, attendance_rate numeric, absent_last_count integer, top_count integer, chronic_absent_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT id, class_id, status FROM public.students WHERE archived_at IS NULL
  ),
  att AS (
    SELECT ea.student_id, s.class_id, ea.percentage, ea.submitted_at
    FROM public.exam_attempts ea
    JOIN s ON s.id = ea.student_id
    WHERE ea.submitted_at IS NOT NULL
  ),
  sched AS (
    SELECT s.id AS student_id, s.class_id, COUNT(DISTINCT e.id)::int AS scheduled
    FROM s
    LEFT JOIN public.exams e
      ON e.published = true
     AND (e.class_id IS NULL OR e.class_id = s.class_id)
     AND (e.starts_at IS NULL OR e.starts_at <= now())
    GROUP BY s.id, s.class_id
  ),
  per_student AS (
    SELECT s.id AS student_id,
           s.class_id,
           s.status,
           COALESCE(sc.scheduled, 0) AS scheduled,
           (SELECT COUNT(*) FROM att a WHERE a.student_id = s.id)::int AS attended,
           (SELECT ROUND(AVG(a.percentage)::numeric, 1) FROM att a WHERE a.student_id = s.id) AS avg_pct
    FROM s
    LEFT JOIN sched sc ON sc.student_id = s.id
  ),
  last_exam AS (
    SELECT DISTINCT ON (s.class_id) s.class_id, e.id AS exam_id
    FROM s
    JOIN public.exams e
      ON e.published = true
     AND (e.class_id IS NULL OR e.class_id = s.class_id)
     AND (e.starts_at IS NULL OR e.starts_at <= now())
    ORDER BY s.class_id, COALESCE(e.starts_at, e.created_at) DESC NULLS LAST
  )
  SELECT c.id, c.name,
    COALESCE(COUNT(ps.student_id) FILTER (WHERE ps.student_id IS NOT NULL), 0)::int,
    COALESCE(COUNT(ps.student_id) FILTER (WHERE ps.status = 'active'), 0)::int,
    ROUND(AVG(ps.avg_pct)::numeric, 1),
    CASE WHEN SUM(ps.scheduled) > 0
      THEN ROUND((SUM(ps.attended)::numeric / SUM(ps.scheduled)) * 100, 1)
      ELSE 0
    END,
    COALESCE(SUM(CASE WHEN le.exam_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.exam_attempts ea2
      WHERE ea2.student_id = ps.student_id AND ea2.exam_id = le.exam_id AND ea2.submitted_at IS NOT NULL
    ) THEN 1 ELSE 0 END), 0)::int,
    COALESCE(COUNT(ps.student_id) FILTER (WHERE ps.avg_pct >= 80), 0)::int,
    COALESCE(COUNT(ps.student_id) FILTER (WHERE ps.scheduled - ps.attended >= 3), 0)::int
  FROM public.classes c
  LEFT JOIN per_student ps ON ps.class_id = c.id
  LEFT JOIN last_exam le ON le.class_id = c.id
  GROUP BY c.id, c.name
  ORDER BY c.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_tree_groups_overview(_class_id uuid)
 RETURNS TABLE(group_id uuid, group_name text, students_count integer, active_count integer, avg_percentage numeric, attendance_rate numeric, absent_last_count integer, top_count integer, chronic_absent_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT id, group_id, class_id, status
    FROM public.students
    WHERE archived_at IS NULL AND class_id = _class_id
  ),
  sched AS (
    SELECT s.id AS student_id, s.group_id, COUNT(DISTINCT e.id)::int AS scheduled
    FROM s
    LEFT JOIN public.exams e
      ON e.published = true
     AND (e.class_id IS NULL OR e.class_id = _class_id)
     AND (COALESCE(array_length(e.group_ids,1),0) = 0 OR s.group_id = ANY(e.group_ids))
     AND (e.starts_at IS NULL OR e.starts_at <= now())
    GROUP BY s.id, s.group_id
  ),
  per_student AS (
    SELECT s.id AS student_id, s.group_id, s.status,
      COALESCE(sc.scheduled, 0) AS scheduled,
      (SELECT COUNT(*) FROM public.exam_attempts ea WHERE ea.student_id = s.id AND ea.submitted_at IS NOT NULL)::int AS attended,
      (SELECT ROUND(AVG(ea.percentage)::numeric, 1) FROM public.exam_attempts ea WHERE ea.student_id = s.id AND ea.submitted_at IS NOT NULL) AS avg_pct
    FROM s
    LEFT JOIN sched sc ON sc.student_id = s.id
  ),
  last_exam_g AS (
    SELECT DISTINCT ON (s.group_id) s.group_id, e.id AS exam_id
    FROM s
    JOIN public.exams e
      ON e.published = true
     AND (e.class_id IS NULL OR e.class_id = _class_id)
     AND (COALESCE(array_length(e.group_ids,1),0) = 0 OR s.group_id = ANY(e.group_ids))
     AND (e.starts_at IS NULL OR e.starts_at <= now())
    ORDER BY s.group_id, COALESCE(e.starts_at, e.created_at) DESC NULLS LAST
  )
  SELECT g.id, g.name,
    COALESCE(COUNT(ps.student_id) FILTER (WHERE ps.student_id IS NOT NULL), 0)::int,
    COALESCE(COUNT(ps.student_id) FILTER (WHERE ps.status = 'active'), 0)::int,
    ROUND(AVG(ps.avg_pct)::numeric, 1),
    CASE WHEN SUM(ps.scheduled) > 0
      THEN ROUND((SUM(ps.attended)::numeric / SUM(ps.scheduled)) * 100, 1)
      ELSE 0
    END,
    COALESCE(SUM(CASE WHEN le.exam_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.exam_attempts ea2
      WHERE ea2.student_id = ps.student_id AND ea2.exam_id = le.exam_id AND ea2.submitted_at IS NOT NULL
    ) THEN 1 ELSE 0 END), 0)::int,
    COALESCE(COUNT(ps.student_id) FILTER (WHERE ps.avg_pct >= 80), 0)::int,
    COALESCE(COUNT(ps.student_id) FILTER (WHERE ps.scheduled - ps.attended >= 3), 0)::int
  FROM public.groups g
  LEFT JOIN per_student ps ON ps.group_id = g.id
  LEFT JOIN last_exam_g le ON le.group_id = g.id
  WHERE g.class_id = _class_id
  GROUP BY g.id, g.name
  ORDER BY g.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_tree_students_in_group(_class_id uuid, _group_id uuid, _limit integer DEFAULT 200, _offset integer DEFAULT 0, _search text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, code text, full_name text, avatar_url text, phone text, parent_name text, parent_phone text, parent_whatsapp text, status text, points integer, level integer, last_seen timestamp with time zone, scheduled_count integer, attended_count integer, absent_count integer, last_exam_id uuid, last_exam_title text, last_exam_attended boolean, last_exam_percentage numeric, avg_percentage numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  q text := NULLIF(trim(_search), '');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT st.*
    FROM public.students st
    WHERE st.archived_at IS NULL
      AND st.class_id = _class_id
      AND st.group_id = _group_id
      AND (q IS NULL OR st.full_name ILIKE '%'||q||'%' OR st.code ILIKE '%'||q||'%' OR COALESCE(st.phone,'') ILIKE '%'||q||'%')
  ),
  sched AS (
    SELECT s.id AS student_id, COUNT(DISTINCT e.id)::int AS scheduled
    FROM s
    LEFT JOIN public.exams e
      ON e.published = true
     AND (e.class_id IS NULL OR e.class_id = _class_id)
     AND (COALESCE(array_length(e.group_ids,1),0) = 0 OR s.group_id = ANY(e.group_ids))
     AND (e.starts_at IS NULL OR e.starts_at <= now())
    GROUP BY s.id
  ),
  att AS (
    SELECT ea.student_id, COUNT(*)::int AS attended,
      ROUND(AVG(ea.percentage)::numeric, 1) AS avg_pct
    FROM public.exam_attempts ea
    WHERE ea.student_id IN (SELECT s.id FROM s)
      AND ea.submitted_at IS NOT NULL
    GROUP BY ea.student_id
  ),
  last_ex AS (
    SELECT DISTINCT ON (s.id) s.id AS student_id, e.id AS exam_id, e.title,
      (ea.submitted_at IS NOT NULL) AS attended, ea.percentage
    FROM s
    JOIN public.exams e
      ON e.published = true
     AND (e.class_id IS NULL OR e.class_id = _class_id)
     AND (COALESCE(array_length(e.group_ids,1),0) = 0 OR s.group_id = ANY(e.group_ids))
     AND (e.starts_at IS NULL OR e.starts_at <= now())
    LEFT JOIN public.exam_attempts ea ON ea.student_id = s.id AND ea.exam_id = e.id
    ORDER BY s.id, COALESCE(e.starts_at, e.created_at) DESC NULLS LAST
  )
  SELECT s.id, s.code, s.full_name, s.avatar_url, s.phone, s.parent_name,
    s.parent_phone, s.parent_whatsapp, s.status, s.points, s.level, s.last_seen,
    COALESCE(sc.scheduled, 0),
    COALESCE(a.attended, 0),
    GREATEST(COALESCE(sc.scheduled,0) - COALESCE(a.attended,0), 0),
    le.exam_id, le.title, COALESCE(le.attended, false), le.percentage,
    COALESCE(a.avg_pct, 0)
  FROM s
  LEFT JOIN sched sc ON sc.student_id = s.id
  LEFT JOIN att a ON a.student_id = s.id
  LEFT JOIN last_ex le ON le.student_id = s.id
  ORDER BY s.full_name
  LIMIT _limit OFFSET _offset;
END;
$function$;
