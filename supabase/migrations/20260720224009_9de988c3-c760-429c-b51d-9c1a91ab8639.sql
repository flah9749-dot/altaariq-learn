
-- Extend messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size BIGINT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_pair ON public.messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread ON public.messages(recipient_id) WHERE read = false;

-- Extend notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, created_at DESC) WHERE read = false;

-- Extend files
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Ensure students can read files that are public / targeted to them
DROP POLICY IF EXISTS "Students read visible files" ON public.files;
CREATE POLICY "Students read visible files" ON public.files
  FOR SELECT TO authenticated
  USING (
    is_public = true
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = auth.uid()
        AND (files.target_class_id IS NULL OR files.target_class_id = s.class_id)
        AND (files.target_group_id IS NULL OR files.target_group_id = s.group_id)
    )
  );

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  target_all BOOLEAN NOT NULL DEFAULT true,
  target_class_ids UUID[] DEFAULT '{}',
  target_group_ids UUID[] DEFAULT '{}',
  target_student_ids UUID[] DEFAULT '{}',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students read targeted announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    published = true
    AND (ends_at IS NULL OR ends_at > now())
    AND starts_at <= now()
    AND (
      target_all = true
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.user_id = auth.uid()
          AND (
            (array_length(target_class_ids, 1) > 0 AND s.class_id = ANY(target_class_ids))
            OR (array_length(target_group_ids, 1) > 0 AND s.group_id = ANY(target_group_ids))
            OR (array_length(target_student_ids, 1) > 0 AND s.id = ANY(target_student_ids))
          )
      )
    )
  );

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Message templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'chat',
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'chat',
  variables TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage templates" ON public.message_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates for chat and whatsapp
INSERT INTO public.message_templates (name, category, body, channel, variables) VALUES
  ('امتحان جديد', 'exam', 'مرحبًا {student_name}، تم نشر امتحان جديد بعنوان "{exam_title}". لا تنسَ حله قبل {end_date}.', 'chat', ARRAY['student_name','exam_title','end_date']),
  ('موعد مراجعة', 'reminder', 'تذكير: موعد المراجعة يوم {date} الساعة {time}.', 'chat', ARRAY['date','time']),
  ('تهنئة', 'congrats', '🎉 تهنئة {student_name}! حصلت على {points} نقطة جديدة. استمر في التميز.', 'chat', ARRAY['student_name','points']),
  ('تنبيه غياب', 'alert', 'تنبيه {student_name}: لاحظنا تراجعًا في تفاعلك. نتمنى انتظامك.', 'chat', ARRAY['student_name']),
  ('إعلان مهم', 'announcement', '📢 إعلان: {message}', 'chat', ARRAY['message']),
  ('نتيجة امتحان (واتساب)', 'result', 'السلام عليكم، نتيجة الطالب {student_name} في امتحان "{exam_title}": الدرجة {score}/{total} ({percentage}%) — التقدير: {grade}. منصة الطارق التعليمية.', 'whatsapp', ARRAY['student_name','exam_title','score','total','percentage','grade']),
  ('تهنئة (واتساب)', 'congrats', 'تهانينا للطالب/ة {student_name}! حصل/ت على جائزة {reward_name}. مع تحيات منصة الطارق التعليمية.', 'whatsapp', ARRAY['student_name','reward_name']),
  ('تذكير (واتساب)', 'reminder', 'تذكير: {message}. مع تحيات المدرس.', 'whatsapp', ARRAY['message'])
ON CONFLICT DO NOTHING;

-- Realtime for messages & notifications & announcements
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

-- Trigger: notification on new message
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sender_name TEXT;
BEGIN
  SELECT COALESCE(s.full_name, a.full_name, 'مستخدم') INTO sender_name
  FROM auth.users u
  LEFT JOIN public.students s ON s.user_id = u.id
  LEFT JOIN public.admins a ON a.user_id = u.id
  WHERE u.id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (NEW.recipient_id, 'رسالة جديدة من ' || sender_name,
          COALESCE(LEFT(NEW.body, 80), 'مرفق'), 'message', '/messages');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_message_notify ON public.messages;
CREATE TRIGGER trg_message_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- Trigger: notification for all students on announcement publish
CREATE OR REPLACE FUNCTION public.notify_on_announcement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (r.user_id, '📢 ' || NEW.title, LEFT(NEW.body, 120), 'announcement', '/student/dashboard');
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_announcement_notify ON public.announcements;
CREATE TRIGGER trg_announcement_notify AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_announcement();
