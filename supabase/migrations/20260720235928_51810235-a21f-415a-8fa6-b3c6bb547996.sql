-- 1) pg_net extension for HTTP calls from DB
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) push_tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Settings row for dispatcher URL + shared secret name (value in edge env)
INSERT INTO public.settings (key, value)
VALUES
  ('push_dispatch_url', to_jsonb('https://project--1e0e7a16-e0cf-40de-9d4a-c663f2382703.lovable.app/api/public/fcm-dispatch'::text))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4) Trigger fn: on new notification, POST to dispatcher
CREATE OR REPLACE FUNCTION public.notify_push_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  dispatch_url text;
  shared_secret text;
BEGIN
  SELECT (value #>> '{}') INTO dispatch_url FROM public.settings WHERE key = 'push_dispatch_url';
  SELECT (value #>> '{}') INTO shared_secret FROM public.settings WHERE key = 'push_dispatch_secret';

  IF dispatch_url IS NULL OR shared_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := dispatch_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', shared_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_dispatch ON public.notifications;
CREATE TRIGGER trg_notify_push_dispatch
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_dispatch();