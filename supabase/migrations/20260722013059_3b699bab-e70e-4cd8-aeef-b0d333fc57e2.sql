
-- 1) students: prevent students from changing privileged columns on their own row
CREATE OR REPLACE FUNCTION public.students_prevent_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins & service role bypass (no auth.uid() when service role)
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Only enforce when the row belongs to the caller (student updating self)
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.points        IS DISTINCT FROM OLD.points        THEN RAISE EXCEPTION 'not allowed: points'; END IF;
  IF NEW.level         IS DISTINCT FROM OLD.level         THEN RAISE EXCEPTION 'not allowed: level'; END IF;
  IF NEW.status        IS DISTINCT FROM OLD.status        THEN RAISE EXCEPTION 'not allowed: status'; END IF;
  IF NEW.group_id      IS DISTINCT FROM OLD.group_id      THEN RAISE EXCEPTION 'not allowed: group_id'; END IF;
  IF NEW.class_id      IS DISTINCT FROM OLD.class_id      THEN RAISE EXCEPTION 'not allowed: class_id'; END IF;
  IF NEW.archived      IS DISTINCT FROM OLD.archived      THEN RAISE EXCEPTION 'not allowed: archived'; END IF;
  IF NEW.archived_at   IS DISTINCT FROM OLD.archived_at   THEN RAISE EXCEPTION 'not allowed: archived_at'; END IF;
  IF NEW.archive_year  IS DISTINCT FROM OLD.archive_year  THEN RAISE EXCEPTION 'not allowed: archive_year'; END IF;
  IF NEW.student_code  IS DISTINCT FROM OLD.student_code  THEN RAISE EXCEPTION 'not allowed: student_code'; END IF;
  IF NEW.user_id       IS DISTINCT FROM OLD.user_id       THEN RAISE EXCEPTION 'not allowed: user_id'; END IF;
  IF NEW.plaintext_password IS DISTINCT FROM OLD.plaintext_password THEN RAISE EXCEPTION 'not allowed: plaintext_password'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_prevent_self_privilege_escalation ON public.students;
CREATE TRIGGER trg_students_prevent_self_privilege_escalation
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.students_prevent_self_privilege_escalation();


-- 2) exam_attempts: students may only update non-grading fields on their own attempts
CREATE OR REPLACE FUNCTION public.exam_attempts_prevent_student_grading_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_owner FROM public.students WHERE id = NEW.student_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.score           IS DISTINCT FROM OLD.score           THEN RAISE EXCEPTION 'not allowed: score'; END IF;
  IF NEW.percentage      IS DISTINCT FROM OLD.percentage      THEN RAISE EXCEPTION 'not allowed: percentage'; END IF;
  IF NEW.total           IS DISTINCT FROM OLD.total           THEN RAISE EXCEPTION 'not allowed: total'; END IF;
  IF NEW.grade           IS DISTINCT FROM OLD.grade           THEN RAISE EXCEPTION 'not allowed: grade'; END IF;
  IF NEW.points_awarded  IS DISTINCT FROM OLD.points_awarded  THEN RAISE EXCEPTION 'not allowed: points_awarded'; END IF;
  IF NEW.approved        IS DISTINCT FROM OLD.approved        THEN RAISE EXCEPTION 'not allowed: approved'; END IF;
  IF NEW.approved_at     IS DISTINCT FROM OLD.approved_at     THEN RAISE EXCEPTION 'not allowed: approved_at'; END IF;
  IF NEW.approved_by     IS DISTINCT FROM OLD.approved_by     THEN RAISE EXCEPTION 'not allowed: approved_by'; END IF;
  IF NEW.admin_notes     IS DISTINCT FROM OLD.admin_notes     THEN RAISE EXCEPTION 'not allowed: admin_notes'; END IF;
  IF NEW.exam_id         IS DISTINCT FROM OLD.exam_id         THEN RAISE EXCEPTION 'not allowed: exam_id'; END IF;
  IF NEW.student_id      IS DISTINCT FROM OLD.student_id      THEN RAISE EXCEPTION 'not allowed: student_id'; END IF;
  IF NEW.started_at      IS DISTINCT FROM OLD.started_at      THEN RAISE EXCEPTION 'not allowed: started_at'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_attempts_prevent_student_grading_edits ON public.exam_attempts;
CREATE TRIGGER trg_exam_attempts_prevent_student_grading_edits
BEFORE UPDATE ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION public.exam_attempts_prevent_student_grading_edits();


-- 3) attempt_answers: students may only update the answer field on their own answers
CREATE OR REPLACE FUNCTION public.attempt_answers_prevent_student_correction_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id
    INTO v_owner
    FROM public.exam_attempts ea
    JOIN public.students s ON s.id = ea.student_id
   WHERE ea.id = NEW.attempt_id;

  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.is_correct           IS DISTINCT FROM OLD.is_correct           THEN RAISE EXCEPTION 'not allowed: is_correct'; END IF;
  IF NEW.awarded_points       IS DISTINCT FROM OLD.awarded_points       THEN RAISE EXCEPTION 'not allowed: awarded_points'; END IF;
  IF NEW.ai_feedback          IS DISTINCT FROM OLD.ai_feedback          THEN RAISE EXCEPTION 'not allowed: ai_feedback'; END IF;
  IF NEW.ai_reasoning         IS DISTINCT FROM OLD.ai_reasoning         THEN RAISE EXCEPTION 'not allowed: ai_reasoning'; END IF;
  IF NEW.ai_suggested_points  IS DISTINCT FROM OLD.ai_suggested_points  THEN RAISE EXCEPTION 'not allowed: ai_suggested_points'; END IF;
  IF NEW.attempt_id           IS DISTINCT FROM OLD.attempt_id           THEN RAISE EXCEPTION 'not allowed: attempt_id'; END IF;
  IF NEW.question_id          IS DISTINCT FROM OLD.question_id          THEN RAISE EXCEPTION 'not allowed: question_id'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attempt_answers_prevent_student_correction_edits ON public.attempt_answers;
CREATE TRIGGER trg_attempt_answers_prevent_student_correction_edits
BEFORE UPDATE ON public.attempt_answers
FOR EACH ROW EXECUTE FUNCTION public.attempt_answers_prevent_student_correction_edits();
