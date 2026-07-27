ALTER TABLE public.registration_requests
  DROP CONSTRAINT IF EXISTS registration_requests_code_id_fkey;

ALTER TABLE public.registration_requests
  ALTER COLUMN code_id DROP NOT NULL;

ALTER TABLE public.registration_requests
  ADD CONSTRAINT registration_requests_code_id_fkey
  FOREIGN KEY (code_id)
  REFERENCES public.join_codes(id)
  ON DELETE SET NULL;