
CREATE POLICY "Admins manage question-bank objects"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'question-bank' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'question-bank' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read question-bank objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'question-bank');
