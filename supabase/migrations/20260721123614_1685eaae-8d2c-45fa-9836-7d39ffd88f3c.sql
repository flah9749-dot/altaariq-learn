
DROP POLICY IF EXISTS "authenticated read public settings" ON public.settings;
CREATE POLICY "authenticated read public settings" ON public.settings
  FOR SELECT TO authenticated
  USING (
    key LIKE 'exam.%'
    OR key LIKE 'platform%'
    OR key LIKE 'rewards.%'
    OR key LIKE 'messages.%'
    OR key LIKE 'security.%'
    OR key LIKE 'teacher.%'
    OR key = 'points_config'
  );
