-- 1. Fix mutable search_path
CREATE OR REPLACE FUNCTION public._sanitize_map_correct(_ca jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 2. Revoke EXECUTE from anon/public on privileged SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.admin_students_overview(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_tree_classes_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_tree_groups_overview(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_tree_students_in_group(uuid, uuid, integer, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.exam_question_analytics(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.weekly_champions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.student_gamification_stats(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_students_overview(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_tree_classes_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_tree_groups_overview(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_tree_students_in_group(uuid, uuid, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.exam_question_analytics(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_champions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_gamification_stats(uuid) TO authenticated, service_role;

-- Public-by-design endpoints keep anon access but are restricted to the exposed roles only
REVOKE ALL ON FUNCTION public.validate_join_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_join_code(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_certificate_verification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_certificate_verification(uuid) TO anon, authenticated, service_role;

-- 3. Trigger functions must never be callable from the API
REVOKE ALL ON FUNCTION public.attempt_answers_prevent_student_correction_edits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exam_attempts_prevent_student_grading_edits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_student_grading_tamper_answers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_student_grading_tamper_attempts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.students_prevent_self_privilege_escalation() FROM PUBLIC, anon, authenticated;

-- 4. Files private by default
ALTER TABLE public.files ALTER COLUMN is_public SET DEFAULT false;

-- 5. Remove plaintext password storage
CREATE OR REPLACE FUNCTION public.students_prevent_self_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.points        IS DISTINCT FROM OLD.points        THEN RAISE EXCEPTION 'not allowed: points'; END IF;
  IF NEW.level         IS DISTINCT FROM OLD.level         THEN RAISE EXCEPTION 'not allowed: level'; END IF;
  IF NEW.status        IS DISTINCT FROM OLD.status        THEN RAISE EXCEPTION 'not allowed: status'; END IF;
  IF NEW.group_id      IS DISTINCT FROM OLD.group_id      THEN RAISE EXCEPTION 'not allowed: group_id'; END IF;
  IF NEW.class_id      IS DISTINCT FROM OLD.class_id      THEN RAISE EXCEPTION 'not allowed: class_id'; END IF;
  IF NEW.archived_at   IS DISTINCT FROM OLD.archived_at   THEN RAISE EXCEPTION 'not allowed: archived_at'; END IF;
  IF NEW.code          IS DISTINCT FROM OLD.code          THEN RAISE EXCEPTION 'not allowed: code'; END IF;
  IF NEW.user_id       IS DISTINCT FROM OLD.user_id       THEN RAISE EXCEPTION 'not allowed: user_id'; END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.students_prevent_self_privilege_escalation() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.students DROP COLUMN IF EXISTS plaintext_password;