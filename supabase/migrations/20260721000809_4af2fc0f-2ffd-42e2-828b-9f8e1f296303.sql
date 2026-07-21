
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_year TEXT;

CREATE INDEX IF NOT EXISTS idx_students_archived_at ON public.students(archived_at);
CREATE INDEX IF NOT EXISTS idx_students_archived_year ON public.students(archived_year);
