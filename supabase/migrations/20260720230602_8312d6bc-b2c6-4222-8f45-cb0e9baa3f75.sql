
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON public.activity_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.activity_log (action);
CREATE INDEX IF NOT EXISTS idx_points_log_student ON public.points_log (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_read ON public.messages (recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_attempts_submitted ON public.exam_attempts (submitted_at DESC) WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON public.ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_created ON public.files (created_at DESC);

INSERT INTO public.settings (key, value) VALUES
  ('platform.name', '"الطارق التعليمية"'::jsonb),
  ('platform.tagline', '"منصة الأستاذ الطارق للدراسات الاجتماعية"'::jsonb),
  ('exam.default_duration_min', '30'::jsonb),
  ('exam.default_pass_score', '50'::jsonb),
  ('exam.shuffle_questions', 'true'::jsonb),
  ('exam.shuffle_options', 'true'::jsonb),
  ('exam.default_attempts', '1'::jsonb),
  ('exam.allow_review', 'true'::jsonb),
  ('exam.show_result_immediately', 'true'::jsonb),
  ('exam.anti_cheat', 'true'::jsonb),
  ('messages.max_file_mb', '20'::jsonb),
  ('messages.retention_days', '365'::jsonb),
  ('rewards.points_enabled', 'true'::jsonb),
  ('rewards.badges_enabled', 'true'::jsonb),
  ('rewards.levels_enabled', 'true'::jsonb),
  ('rewards.shop_enabled', 'true'::jsonb),
  ('security.session_hours', '24'::jsonb),
  ('security.max_login_attempts', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;
