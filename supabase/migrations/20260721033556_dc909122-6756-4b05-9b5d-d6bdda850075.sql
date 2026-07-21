REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_primary_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_primary_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_get_exam_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_exam_questions(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_attempt_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_review(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_on_message() TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_points_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_points_change() TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_on_announcement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_on_announcement() TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_push_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_push_dispatch() TO service_role;

REVOKE EXECUTE ON FUNCTION public.recompute_student_level(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_student_level(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.attempt_answers_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attempt_answers_guard() TO service_role;

REVOKE EXECUTE ON FUNCTION public.messages_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messages_guard() TO service_role;

REVOKE EXECUTE ON FUNCTION public.exam_attempts_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exam_attempts_guard() TO service_role;