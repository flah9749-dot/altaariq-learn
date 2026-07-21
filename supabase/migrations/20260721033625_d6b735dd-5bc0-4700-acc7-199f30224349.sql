REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_primary_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_exam_questions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_attempt_review(uuid) TO authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;