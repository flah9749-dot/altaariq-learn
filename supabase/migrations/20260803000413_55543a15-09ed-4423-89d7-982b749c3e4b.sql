DROP TRIGGER IF EXISTS trg_exam_attempts_guard ON public.exam_attempts;
CREATE TRIGGER trg_exam_attempts_guard
BEFORE INSERT OR UPDATE ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION public.exam_attempts_guard();

DROP TRIGGER IF EXISTS trg_exam_attempts_prevent_student_grading_edits ON public.exam_attempts;
CREATE TRIGGER trg_exam_attempts_prevent_student_grading_edits
BEFORE UPDATE ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION public.exam_attempts_prevent_student_grading_edits();

DROP TRIGGER IF EXISTS trg_attempt_answers_guard ON public.attempt_answers;
CREATE TRIGGER trg_attempt_answers_guard
BEFORE INSERT OR UPDATE ON public.attempt_answers
FOR EACH ROW EXECUTE FUNCTION public.attempt_answers_guard();

DROP TRIGGER IF EXISTS trg_attempt_answers_prevent_student_correction_edits ON public.attempt_answers;
CREATE TRIGGER trg_attempt_answers_prevent_student_correction_edits
BEFORE UPDATE ON public.attempt_answers
FOR EACH ROW EXECUTE FUNCTION public.attempt_answers_prevent_student_correction_edits();
