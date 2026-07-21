
CREATE OR REPLACE FUNCTION public.exam_attempts_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('submitted','in_progress') THEN
      RAISE EXCEPTION 'Students cannot set that status';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- Force safe defaults instead of NULL (columns are NOT NULL)
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
