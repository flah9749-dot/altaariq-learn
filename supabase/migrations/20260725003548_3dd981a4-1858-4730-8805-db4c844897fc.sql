
-- Trigger to prevent students from tampering with grading fields on exam_attempts
CREATE OR REPLACE FUNCTION public.prevent_student_grading_tamper_attempts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.score IS DISTINCT FROM OLD.score
     OR NEW.percentage IS DISTINCT FROM OLD.percentage
     OR NEW.grade IS DISTINCT FROM OLD.grade
     OR NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.points_awarded IS DISTINCT FROM OLD.points_awarded
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
  THEN
    RAISE EXCEPTION 'غير مسموح بتعديل حقول التصحيح والاعتماد';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_grading_tamper_attempts ON public.exam_attempts;
CREATE TRIGGER trg_prevent_student_grading_tamper_attempts
BEFORE UPDATE ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION public.prevent_student_grading_tamper_attempts();

-- Trigger to prevent students from tampering with grading fields on attempt_answers
CREATE OR REPLACE FUNCTION public.prevent_student_grading_tamper_answers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.awarded_points IS DISTINCT FROM OLD.awarded_points
     OR NEW.is_correct IS DISTINCT FROM OLD.is_correct
     OR NEW.ai_feedback IS DISTINCT FROM OLD.ai_feedback
     OR NEW.ai_suggested_points IS DISTINCT FROM OLD.ai_suggested_points
     OR NEW.graded_by IS DISTINCT FROM OLD.graded_by
     OR NEW.graded_at IS DISTINCT FROM OLD.graded_at
  THEN
    RAISE EXCEPTION 'غير مسموح بتعديل حقول التصحيح';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_grading_tamper_answers ON public.attempt_answers;
CREATE TRIGGER trg_prevent_student_grading_tamper_answers
BEFORE UPDATE ON public.attempt_answers
FOR EACH ROW EXECUTE FUNCTION public.prevent_student_grading_tamper_answers();
