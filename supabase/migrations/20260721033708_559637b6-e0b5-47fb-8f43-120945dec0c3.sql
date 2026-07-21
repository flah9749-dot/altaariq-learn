DROP POLICY IF EXISTS "Chat participants read attachments" ON storage.objects;

CREATE POLICY "Chat participants read attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.attachment_url = storage.objects.name
      AND (m.sender_id = (select auth.uid()) OR m.recipient_id = (select auth.uid()))
  )
);