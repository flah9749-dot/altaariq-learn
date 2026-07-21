REVOKE EXECUTE ON FUNCTION public.apply_points_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attempt_answers_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.exam_attempts_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.messages_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_announcement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_push_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_student_level(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_points_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.attempt_answers_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.exam_attempts_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.messages_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_announcement() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_message() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_push_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_student_level(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;