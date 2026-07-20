
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;

DROP POLICY IF EXISTS "system insert ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "admin insert ai_usage_logs" ON public.ai_usage_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
