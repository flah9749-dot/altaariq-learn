ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS exam_start_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_exams_start_notification_due
  ON public.exams (starts_at)
  WHERE published = true AND starts_at IS NOT NULL AND exam_start_notified_at IS NULL;

CREATE OR REPLACE FUNCTION public.dispatch_due_exam_start_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exam_row record;
  inserted_count integer := 0;
  last_count integer := 0;
  exam_link text;
BEGIN
  FOR exam_row IN
    SELECT id, title, class_id, group_ids, starts_at, ends_at
    FROM public.exams
    WHERE published = true
      AND starts_at IS NOT NULL
      AND starts_at <= now()
      AND exam_start_notified_at IS NULL
      AND (ends_at IS NULL OR ends_at > now())
    ORDER BY starts_at ASC
    LIMIT 50
  LOOP
    UPDATE public.exams
    SET exam_start_notified_at = now()
    WHERE id = exam_row.id
      AND exam_start_notified_at IS NULL;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    exam_link := '/student/exams/' || exam_row.id::text || '/start';

    INSERT INTO public.notifications (user_id, title, body, type, link)
    SELECT DISTINCT
      s.user_id,
      '⏰ بدأ الامتحان الآن',
      'يمكنك الآن دخول امتحان: ' || COALESCE(exam_row.title, 'امتحان جديد'),
      'exam_start',
      exam_link
    FROM public.students s
    WHERE s.user_id IS NOT NULL
      AND s.status = 'active'
      AND (exam_row.class_id IS NULL OR s.class_id = exam_row.class_id)
      AND (
        COALESCE(array_length(exam_row.group_ids, 1), 0) = 0
        OR s.group_id = ANY(exam_row.group_ids)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = s.user_id
          AND n.type = 'exam_start'
          AND n.link = exam_link
      );

    GET DIAGNOSTICS last_count = ROW_COUNT;
    inserted_count := inserted_count + last_count;
  END LOOP;

  RETURN inserted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispatch_due_exam_start_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_exam_start_notifications() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('exam-start-notifications');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'exam-start-notifications',
  '* * * * *',
  'SELECT public.dispatch_due_exam_start_notifications();'
);