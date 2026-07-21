
CREATE OR REPLACE FUNCTION public.exam_attempts_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role (no auth context) or admin bypasses all checks
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
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

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('submitted','in_progress') THEN
      RAISE EXCEPTION 'Students cannot set that status';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.score := 0;
    NEW.total := COALESCE(NEW.total, 0);
    NEW.percentage := 0;
    NEW.grade := NULL;
    NEW.approved := false;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.points_awarded := 0;
    NEW.admin_notes := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.attempt_answers_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role (no auth context) or admin bypasses all checks
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.messages_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
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
$function$;
