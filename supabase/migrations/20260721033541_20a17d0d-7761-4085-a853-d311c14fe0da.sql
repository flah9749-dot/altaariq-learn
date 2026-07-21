DROP POLICY IF EXISTS "Chat users upload own attachments" ON storage.objects;

CREATE POLICY "Chat users upload own attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);