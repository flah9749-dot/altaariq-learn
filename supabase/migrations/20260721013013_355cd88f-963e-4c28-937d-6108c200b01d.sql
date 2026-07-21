
-- 1) attempt_answers: split students' ALL policy into narrow INSERT + column-guarded UPDATE

DROP POLICY IF EXISTS "Students manage own answers" ON public.attempt_answers;

CREATE POLICY "Students insert own answers"
ON public.attempt_answers
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.exam_attempts a
  WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()
));

CREATE POLICY "Students read own answers"
ON public.attempt_answers
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.exam_attempts a
  WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()
));

CREATE POLICY "Students update own answer text"
ON public.attempt_answers
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.exam_attempts a
  WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.exam_attempts a
  WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()
));

-- Trigger: prevent non-admin from touching grading columns
CREATE OR REPLACE FUNCTION public.attempt_answers_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_correct         IS DISTINCT FROM OLD.is_correct
    OR NEW.awarded_points     IS DISTINCT FROM OLD.awarded_points
    OR NEW.ai_suggested_points IS DISTINCT FROM OLD.ai_suggested_points
    OR NEW.ai_feedback        IS DISTINCT FROM OLD.ai_feedback
    OR NEW.ai_reasoning       IS DISTINCT FROM OLD.ai_reasoning
    THEN
      RAISE EXCEPTION 'Only admins can modify grading fields';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.is_correct := NULL;
    NEW.awarded_points := NULL;
    NEW.ai_suggested_points := NULL;
    NEW.ai_feedback := NULL;
    NEW.ai_reasoning := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attempt_answers_guard_trg ON public.attempt_answers;
CREATE TRIGGER attempt_answers_guard_trg
BEFORE INSERT OR UPDATE ON public.attempt_answers
FOR EACH ROW EXECUTE FUNCTION public.attempt_answers_guard();


-- 2) exam_attempts: guard scoring/approval columns from student self-update

CREATE OR REPLACE FUNCTION public.exam_attempts_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.score          IS DISTINCT FROM OLD.score
    OR NEW.total          IS DISTINCT FROM OLD.total
    OR NEW.percentage     IS DISTINCT FROM OLD.percentage
    OR NEW.grade          IS DISTINCT FROM OLD.grade
    OR NEW.approved       IS DISTINCT FROM OLD.approved
    OR NEW.approved_at    IS DISTINCT FROM OLD.approved_at
    OR NEW.approved_by    IS DISTINCT FROM OLD.approved_by
    OR NEW.points_awarded IS DISTINCT FROM OLD.points_awarded
    OR NEW.admin_notes    IS DISTINCT FROM OLD.admin_notes
    OR NEW.review_marks   IS DISTINCT FROM OLD.review_marks
    OR NEW.needs_review   IS DISTINCT FROM OLD.needs_review
    THEN
      RAISE EXCEPTION 'Only admins can modify scoring or approval fields';
    END IF;

    -- Students can only mark status as submitted, not arbitrarily
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('submitted','in_progress') THEN
      RAISE EXCEPTION 'Students cannot set that status';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.score := NULL;
    NEW.total := COALESCE(NEW.total, NULL);
    NEW.percentage := NULL;
    NEW.grade := NULL;
    NEW.approved := false;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.points_awarded := 0;
    NEW.admin_notes := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exam_attempts_guard_trg ON public.exam_attempts;
CREATE TRIGGER exam_attempts_guard_trg
BEFORE INSERT OR UPDATE ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION public.exam_attempts_guard();


-- 3) messages: recipients may only mark as read/delivered; senders can soft-delete their own

DROP POLICY IF EXISTS "user update own messages" ON public.messages;

CREATE POLICY "recipient marks message read"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id OR auth.uid() = sender_id)
WITH CHECK (auth.uid() = recipient_id OR auth.uid() = sender_id);

CREATE OR REPLACE FUNCTION public.messages_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Recipient: only read/delivered flags
    IF auth.uid() = OLD.recipient_id AND auth.uid() <> OLD.sender_id THEN
      IF NEW.sender_id       IS DISTINCT FROM OLD.sender_id
      OR NEW.recipient_id    IS DISTINCT FROM OLD.recipient_id
      OR NEW.body            IS DISTINCT FROM OLD.body
      OR NEW.message_type    IS DISTINCT FROM OLD.message_type
      OR NEW.attachment_url  IS DISTINCT FROM OLD.attachment_url
      OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name
      OR NEW.attachment_mime IS DISTINCT FROM OLD.attachment_mime
      OR NEW.attachment_size IS DISTINCT FROM OLD.attachment_size
      OR NEW.reply_to        IS DISTINCT FROM OLD.reply_to
      OR NEW.created_at      IS DISTINCT FROM OLD.created_at
      THEN
        RAISE EXCEPTION 'Recipient can only mark messages as read or delivered';
      END IF;
    END IF;
    -- Sender: cannot alter recipient or sender_id
    IF auth.uid() = OLD.sender_id THEN
      IF NEW.sender_id    IS DISTINCT FROM OLD.sender_id
      OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
      THEN
        RAISE EXCEPTION 'Cannot change sender or recipient';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_guard_trg ON public.messages;
CREATE TRIGGER messages_guard_trg
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_guard();


-- 4) settings: restrict read to authenticated users only

DROP POLICY IF EXISTS "anyone read settings" ON public.settings;

CREATE POLICY "authenticated read settings"
ON public.settings
FOR SELECT
TO authenticated
USING (true);
