
-- 1) Fix exam submit error: attempt_answers has no graded_by/graded_at columns
CREATE OR REPLACE FUNCTION public.prevent_student_grading_tamper_answers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.awarded_points IS DISTINCT FROM OLD.awarded_points
     OR NEW.is_correct IS DISTINCT FROM OLD.is_correct
     OR NEW.ai_feedback IS DISTINCT FROM OLD.ai_feedback
     OR NEW.ai_suggested_points IS DISTINCT FROM OLD.ai_suggested_points
  THEN
    RAISE EXCEPTION 'غير مسموح بتعديل حقول التصحيح';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Videos module
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  term text,
  unit text,
  lesson text,
  provider text NOT NULL DEFAULT 'upload',
  source_url text,
  storage_path text,
  thumbnail_url text,
  duration_sec integer NOT NULL DEFAULT 0,
  access_type text NOT NULL DEFAULT 'free',
  publish_at timestamptz,
  access_expires_at timestamptz,
  views_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT videos_provider_chk CHECK (provider IN ('upload','youtube','bunny','cloudflare','url')),
  CONSTRAINT videos_access_chk CHECK (access_type IN ('free','paid','hidden','scheduled'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.video_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'file',
  size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_attachments TO authenticated;
GRANT ALL ON public.video_attachments TO service_role;
ALTER TABLE public.video_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.video_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'student',
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  expires_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_grants_scope_chk CHECK (scope IN ('student','group','class','all'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_access_grants TO authenticated;
GRANT ALL ON public.video_access_grants TO service_role;
ALTER TABLE public.video_access_grants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.video_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  position_sec integer NOT NULL DEFAULT 0,
  watched_sec integer NOT NULL DEFAULT 0,
  percent numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  last_watched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_progress TO authenticated;
GRANT ALL ON public.video_progress TO service_role;
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_videos_class ON public.videos(class_id, group_id);
CREATE INDEX idx_video_progress_student ON public.video_progress(student_id);
CREATE INDEX idx_video_grants_video ON public.video_access_grants(video_id);

-- helper: current student row
CREATE OR REPLACE FUNCTION public.current_student()
RETURNS TABLE(id uuid, class_id uuid, group_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT s.id, s.class_id, s.group_id FROM public.students s WHERE s.user_id = auth.uid() LIMIT 1 $$;
REVOKE EXECUTE ON FUNCTION public.current_student() FROM anon;

-- video is targeted at the current student (class/group match)
CREATE OR REPLACE FUNCTION public.video_targets_me(_video_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.videos v, public.current_student() cs
    WHERE v.id = _video_id
      AND (v.class_id IS NULL OR v.class_id = cs.class_id)
      AND (v.group_id IS NULL OR v.group_id = cs.group_id)
      AND v.access_type <> 'hidden'
      AND (v.access_type <> 'scheduled' OR (v.publish_at IS NOT NULL AND v.publish_at <= now()))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.video_targets_me(uuid) FROM anon;

-- can the current student actually watch (playback)?
CREATE OR REPLACE FUNCTION public.can_watch_video(_video_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v public.videos%ROWTYPE; cs record; ok boolean;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN true; END IF;
  SELECT * INTO v FROM public.videos WHERE id = _video_id;
  IF v.id IS NULL THEN RETURN false; END IF;
  SELECT * INTO cs FROM public.current_student();
  IF cs.id IS NULL THEN RETURN false; END IF;
  IF v.class_id IS NOT NULL AND v.class_id <> cs.class_id THEN RETURN false; END IF;
  IF v.group_id IS NOT NULL AND v.group_id <> cs.group_id THEN RETURN false; END IF;
  IF v.access_type = 'hidden' THEN RETURN false; END IF;
  IF v.access_type = 'scheduled' AND (v.publish_at IS NULL OR v.publish_at > now()) THEN RETURN false; END IF;
  IF v.access_expires_at IS NOT NULL AND v.access_expires_at <= now() THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.video_access_grants g
    WHERE (g.video_id = _video_id OR g.video_id IS NULL)
      AND (g.expires_at IS NULL OR g.expires_at > now())
      AND (
        g.scope = 'all'
        OR (g.scope = 'student' AND g.student_id = cs.id)
        OR (g.scope = 'group' AND g.group_id = cs.group_id)
        OR (g.scope = 'class' AND g.class_id = cs.class_id)
      )
  ) INTO ok;

  IF v.access_type = 'paid' THEN RETURN ok; END IF;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.can_watch_video(uuid) FROM anon;

-- policies
CREATE POLICY "admins manage videos" ON public.videos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "students view targeted videos" ON public.videos FOR SELECT TO authenticated
  USING (public.video_targets_me(id));

CREATE POLICY "admins manage video attachments" ON public.video_attachments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "students view attachments of allowed videos" ON public.video_attachments FOR SELECT TO authenticated
  USING (public.can_watch_video(video_id));

CREATE POLICY "admins manage video grants" ON public.video_access_grants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins read all progress" ON public.video_progress FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "students manage own progress" ON public.video_progress FOR ALL TO authenticated
  USING (student_id IN (SELECT id FROM public.current_student()))
  WITH CHECK (student_id IN (SELECT id FROM public.current_student()) AND public.can_watch_video(video_id));

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_video_progress_updated_at BEFORE UPDATE ON public.video_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
