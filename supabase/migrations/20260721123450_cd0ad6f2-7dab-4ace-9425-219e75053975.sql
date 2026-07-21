
-- 1. Settings: hide sensitive keys from students
DROP POLICY IF EXISTS "authenticated read settings" ON public.settings;
CREATE POLICY "authenticated read public settings" ON public.settings
  FOR SELECT TO authenticated
  USING (
    key NOT LIKE 'push_dispatch%'
    AND key NOT ILIKE '%secret%'
    AND key NOT ILIKE '%_key'
    AND key NOT ILIKE '%api%'
    AND key NOT ILIKE '%token%'
  );

-- 2. Answer keys: revoke column-level SELECT from authenticated
REVOKE SELECT (correct_answer, explanation) ON public.questions FROM authenticated;
REVOKE SELECT (is_correct) ON public.question_options FROM authenticated;

-- 3. Exam attempts: revoke column-level UPDATE on scoring/approval fields
REVOKE UPDATE (score, total, percentage, grade, points_awarded, approved, approved_at, approved_by, admin_notes, needs_review) ON public.exam_attempts FROM authenticated;

-- 4. Attempt answers: revoke column-level UPDATE on grading fields
REVOKE UPDATE (is_correct, awarded_points, ai_suggested_points, ai_feedback, ai_reasoning) ON public.attempt_answers FROM authenticated;

-- 5. Messages: recipient may only update read/delivered flags
REVOKE UPDATE (body, attachment_url, attachment_name, attachment_mime, attachment_size, sender_id, recipient_id, message_type, reply_to, created_at) ON public.messages FROM authenticated;
