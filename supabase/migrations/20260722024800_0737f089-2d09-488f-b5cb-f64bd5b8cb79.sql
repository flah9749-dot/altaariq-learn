
-- 1) Add exam kind
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS exam_kind text NOT NULL DEFAULT 'standard';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exams_kind_chk'
  ) THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_kind_chk CHECK (exam_kind IN ('standard','map'));
  END IF;
END $$;

-- 2) Map exam pages (one or more maps per exam)
CREATE TABLE IF NOT EXISTS public.map_exam_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  title text,
  map_type text,
  original_image_url text,
  clean_image_url text,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_exam_pages TO authenticated;
GRANT ALL ON public.map_exam_pages TO service_role;
ALTER TABLE public.map_exam_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_map_exam_pages" ON public.map_exam_pages;
CREATE POLICY "admin_manage_map_exam_pages" ON public.map_exam_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "read_map_exam_pages" ON public.map_exam_pages;
CREATE POLICY "read_map_exam_pages" ON public.map_exam_pages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = exam_id AND (e.published = true OR public.has_role(auth.uid(),'admin'))
  ));
DROP TRIGGER IF EXISTS trg_map_exam_pages_updated ON public.map_exam_pages;
CREATE TRIGGER trg_map_exam_pages_updated
  BEFORE UPDATE ON public.map_exam_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_map_exam_pages_exam ON public.map_exam_pages(exam_id);

-- 3) Map exam markers (numbered points on a map page)
CREATE TABLE IF NOT EXISTS public.map_exam_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.map_exam_pages(id) ON DELETE CASCADE,
  number int NOT NULL DEFAULT 1,
  x numeric NOT NULL DEFAULT 50,
  y numeric NOT NULL DEFAULT 50,
  label text,
  hint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_exam_markers TO authenticated;
GRANT ALL ON public.map_exam_markers TO service_role;
ALTER TABLE public.map_exam_markers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_map_exam_markers" ON public.map_exam_markers;
CREATE POLICY "admin_manage_map_exam_markers" ON public.map_exam_markers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "read_map_exam_markers" ON public.map_exam_markers;
CREATE POLICY "read_map_exam_markers" ON public.map_exam_markers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.map_exam_pages p
    JOIN public.exams e ON e.id = p.exam_id
    WHERE p.id = page_id AND (e.published = true OR public.has_role(auth.uid(),'admin'))
  ));
DROP TRIGGER IF EXISTS trg_map_exam_markers_updated ON public.map_exam_markers;
CREATE TRIGGER trg_map_exam_markers_updated
  BEFORE UPDATE ON public.map_exam_markers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_map_exam_markers_page ON public.map_exam_markers(page_id);

-- 4) Link existing questions table to map markers so attempt_answers still works via question_id
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS map_marker_id uuid REFERENCES public.map_exam_markers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS map_page_id uuid REFERENCES public.map_exam_pages(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_questions_map_marker ON public.questions(map_marker_id);
CREATE INDEX IF NOT EXISTS idx_questions_map_page ON public.questions(map_page_id);
