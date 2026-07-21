REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_primary_admin() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_primary_admin() TO service_role;