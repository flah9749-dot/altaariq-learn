
CREATE TABLE IF NOT EXISTS public.backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'manual',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  tables JSONB NOT NULL DEFAULT '[]'::jsonb,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage backups" ON public.backups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read backup files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write backup files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete backup files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));
