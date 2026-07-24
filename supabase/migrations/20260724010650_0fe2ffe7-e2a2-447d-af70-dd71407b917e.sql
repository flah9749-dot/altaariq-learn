
-- ============ 1) Notifications dedupe ============
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_uniq
  ON public.notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Update trigger functions to set dedupe_key with ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION public.notify_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sender_name TEXT;
  recipient_link TEXT;
BEGIN
  SELECT COALESCE(s.full_name, a.full_name, 'مستخدم') INTO sender_name
  FROM auth.users u
  LEFT JOIN public.students s ON s.user_id = u.id
  LEFT JOIN public.admins a ON a.user_id = u.id
  WHERE u.id = NEW.sender_id;

  IF public.has_role(NEW.recipient_id, 'admin'::app_role) THEN
    recipient_link := '/admin/messages';
  ELSE
    recipient_link := '/student/messages';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, link, dedupe_key)
  VALUES (NEW.recipient_id, 'رسالة جديدة من ' || sender_name,
          COALESCE(LEFT(NEW.body, 80), 'مرفق'), 'message', recipient_link,
          'msg:' || NEW.id::text)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_on_announcement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  IF NEW.published = false THEN RETURN NEW; END IF;
  FOR r IN
    SELECT s.user_id FROM public.students s
    WHERE s.user_id IS NOT NULL AND s.status = 'active'
      AND (
        NEW.target_all = true
        OR (array_length(NEW.target_class_ids, 1) > 0 AND s.class_id = ANY(NEW.target_class_ids))
        OR (array_length(NEW.target_group_ids, 1) > 0 AND s.group_id = ANY(NEW.target_group_ids))
        OR (array_length(NEW.target_student_ids, 1) > 0 AND s.id = ANY(NEW.target_student_ids))
      )
  LOOP
    INSERT INTO public.notifications (user_id, title, body, type, link, dedupe_key)
    VALUES (r.user_id, '📢 ' || NEW.title, LEFT(NEW.body, 120), 'announcement', '/student/dashboard',
            'ann:' || NEW.id::text)
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END LOOP;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.apply_points_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.students
    SET points = GREATEST(0, COALESCE(points,0) + NEW.points)
    WHERE id = NEW.student_id;
  PERFORM public.recompute_student_level(NEW.student_id);
  INSERT INTO public.notifications(user_id, title, body, type, link, dedupe_key)
  SELECT s.user_id,
    CASE WHEN NEW.points >= 0 THEN '⭐ حصلت على نقاط' ELSE '⚠️ تم خصم نقاط' END,
    COALESCE(NEW.reason,'') || ' (' || NEW.points || ')',
    'points', '/student/points',
    'points:' || NEW.id::text
  FROM public.students s WHERE s.id = NEW.student_id AND s.user_id IS NOT NULL
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_due_exam_start_notifications()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    IF NOT FOUND THEN CONTINUE; END IF;
    exam_link := '/student/exams/' || exam_row.id::text || '/start';

    INSERT INTO public.notifications (user_id, title, body, type, link, dedupe_key)
    SELECT DISTINCT
      s.user_id,
      '⏰ بدأ الامتحان الآن',
      'يمكنك الآن دخول امتحان: ' || COALESCE(exam_row.title, 'امتحان جديد'),
      'exam_start',
      exam_link,
      'exam_start:' || exam_row.id::text
    FROM public.students s
    WHERE s.user_id IS NOT NULL
      AND s.status = 'active'
      AND (exam_row.class_id IS NULL OR s.class_id = exam_row.class_id)
      AND (
        COALESCE(array_length(exam_row.group_ids, 1), 0) = 0
        OR s.group_id = ANY(exam_row.group_ids)
      )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

    GET DIAGNOSTICS last_count = ROW_COUNT;
    inserted_count := inserted_count + last_count;
  END LOOP;

  RETURN inserted_count;
END;
$function$;

-- ============ 2) Reset AI quota counters + admin unlimited ============
DELETE FROM public.ai_quota_usage;

-- Make admin unlimited by setting high limits
UPDATE public.ai_quota_policies
SET limit_count = 999999, max_file_mb = 200, max_pages = 500, enabled = true
WHERE role = 'admin';

-- Insert admin unlimited policies for any feature not yet covered
INSERT INTO public.ai_quota_policies (role, feature, period, limit_count, max_file_mb, max_pages, enabled)
SELECT 'admin', f, 'daily', 999999, 200, 500, true
FROM (VALUES
  ('assistant_message'),('file_upload'),('exam_generation'),('essay_grading'),
  ('summary'),('lesson_explain'),('map_analysis'),('content_plan')
) t(f)
ON CONFLICT DO NOTHING;

-- ============ 3) Question Bank ============
CREATE TABLE IF NOT EXISTS public.question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  entry_type TEXT NOT NULL DEFAULT 'question' CHECK (entry_type IN ('question','material')),
  question_type TEXT CHECK (question_type IN ('mcq','true_false','short','essay','map')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL DEFAULT 'general',
  grade_level TEXT,
  unit TEXT,
  chapter TEXT,
  topic TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  points INTEGER NOT NULL DEFAULT 1 CHECK (points >= 0),
  tags TEXT[] NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','students')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai_generated','imported')),
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on question_bank"
  ON public.question_bank FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students read visible question_bank"
  ON public.question_bank FOR SELECT TO authenticated
  USING (visibility = 'students');

CREATE TRIGGER question_bank_updated_at
  BEFORE UPDATE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS question_bank_subject_idx ON public.question_bank(subject);
CREATE INDEX IF NOT EXISTS question_bank_visibility_idx ON public.question_bank(visibility);
CREATE INDEX IF NOT EXISTS question_bank_grade_unit_idx ON public.question_bank(grade_level, unit);
CREATE INDEX IF NOT EXISTS question_bank_tags_idx ON public.question_bank USING GIN(tags);
CREATE INDEX IF NOT EXISTS question_bank_created_idx ON public.question_bank(created_at DESC);
