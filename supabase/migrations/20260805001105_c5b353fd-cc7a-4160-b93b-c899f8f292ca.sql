
CREATE POLICY "admins manage videos bucket" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'videos' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'videos' AND public.has_role(auth.uid(), 'admin'::app_role));
