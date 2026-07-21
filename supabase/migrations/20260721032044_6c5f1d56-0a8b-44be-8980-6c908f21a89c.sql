
-- 1) Allow chat participants (not just uploader) to read chat-files attachments
DROP POLICY IF EXISTS "Chat participants read attachments" ON storage.objects;
CREATE POLICY "Chat participants read attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.attachment_url = storage.objects.name
      AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
  )
);

-- 2) Fix notify_on_message trigger to route link based on recipient role
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

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (NEW.recipient_id, 'رسالة جديدة من ' || sender_name,
          COALESCE(LEFT(NEW.body, 80), 'مرفق'), 'message', recipient_link);
  RETURN NEW;
END; $function$;

-- 3) Fix announcement notifications: link goes to student dashboard, keep as-is if already valid.
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
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (r.user_id, '📢 ' || NEW.title, LEFT(NEW.body, 120), 'announcement', '/student/dashboard');
  END LOOP;
  RETURN NEW;
END; $function$;

-- 4) Backfill existing bad links
UPDATE public.notifications
SET link = CASE WHEN public.has_role(user_id, 'admin'::app_role) THEN '/admin/messages' ELSE '/student/messages' END
WHERE type = 'message' AND (link = '/messages' OR link IS NULL);
