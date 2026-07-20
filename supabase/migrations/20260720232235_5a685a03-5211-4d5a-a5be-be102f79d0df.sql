CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS students_full_name_trgm ON public.students USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS students_phone_trgm ON public.students USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS students_parent_phone_trgm ON public.students USING gin (parent_phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS students_points_desc ON public.students (points DESC);

CREATE INDEX IF NOT EXISTS announcements_published_created_idx ON public.announcements (published, created_at DESC);

CREATE INDEX IF NOT EXISTS points_log_student_created_idx ON public.points_log (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reward_redemptions_student_created_idx ON public.reward_redemptions (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reward_redemptions_status_created_idx ON public.reward_redemptions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS attempt_answers_question_idx ON public.attempt_answers (question_id);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS files_owner_created_idx ON public.files (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS files_category_idx ON public.files (category);

CREATE INDEX IF NOT EXISTS student_badges_student_idx ON public.student_badges (student_id);
CREATE INDEX IF NOT EXISTS student_achievements_student_idx ON public.student_achievements (student_id);

CREATE INDEX IF NOT EXISTS exam_attempts_student_exam_idx ON public.exam_attempts (student_id, exam_id);

CREATE INDEX IF NOT EXISTS activity_log_actor_created_idx ON public.activity_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_provider_created_idx ON public.ai_usage_logs (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_success_created_idx ON public.ai_usage_logs (success, created_at DESC);