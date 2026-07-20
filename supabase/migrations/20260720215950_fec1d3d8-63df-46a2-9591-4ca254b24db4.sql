
-- Admin has full access to all buckets
CREATE POLICY "admin all storage" ON storage.objects FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Authenticated read for public-display buckets
CREATE POLICY "authenticated read display buckets" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('avatars','logos','reward-images'));

-- Users can upload their own avatar (path starts with their uid)
CREATE POLICY "user upload own avatar" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user update own avatar" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Students can read their own private files (student-files/{uid}/...)
CREATE POLICY "user read own private files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('student-files','chat-files') AND (storage.foldername(name))[1] = auth.uid()::text);
