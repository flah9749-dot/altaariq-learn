
ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS points_awarded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_marks jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.attempt_answers
  ADD COLUMN IF NOT EXISTS ai_suggested_points numeric,
  ADD COLUMN IF NOT EXISTS ai_feedback text;

INSERT INTO public.settings (key, value)
VALUES ('points_config', '{"per_percent": 1, "bonus_pass": 10, "bonus_excellent": 25}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS exam_attempts_approved_idx ON public.exam_attempts(approved);
CREATE INDEX IF NOT EXISTS exam_attempts_status_idx ON public.exam_attempts(status);
