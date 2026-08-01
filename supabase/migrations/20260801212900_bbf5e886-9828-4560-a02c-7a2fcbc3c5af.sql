-- ============ Phase 1: provider layer ============
ALTER TABLE public.ai_providers ADD COLUMN IF NOT EXISTS base_url text;

UPDATE public.ai_providers SET base_url = 'https://openrouter.ai/api/v1/chat/completions'
  WHERE slug = 'openrouter' AND base_url IS NULL;

INSERT INTO public.ai_providers (slug, name, enabled, priority, base_url, default_model, secret_name)
VALUES
  ('together', 'Together AI', false, 30, 'https://api.together.xyz/v1/chat/completions', 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'TOGETHER_API_KEY'),
  ('ollama',   'Ollama (محلي)', false, 40, 'http://localhost:11434/v1/chat/completions', 'qwen2.5:7b-instruct', 'OLLAMA_API_KEY'),
  ('custom',   'مزود مخصص (OpenAI-compatible)', false, 50, NULL, NULL, 'CUSTOM_AI_API_KEY')
ON CONFLICT (slug) DO NOTHING;

-- ============ Phase 2: knowledge base ============
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.kb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  title text NOT NULL,
  storage_path text,
  mime_type text,
  doc_type text NOT NULL DEFAULT 'book',
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT 'دراسات اجتماعية',
  term text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  chunk_count integer NOT NULL DEFAULT 0,
  page_count integer,
  char_count integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_documents TO authenticated;
GRANT ALL ON public.kb_documents TO service_role;
ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_documents_admin_all" ON public.kb_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kb_documents_student_read" ON public.kb_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'student'));

CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  doc_type text NOT NULL DEFAULT 'book',
  unit text,
  lesson text,
  heading text,
  page_number integer,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  token_estimate integer NOT NULL DEFAULT 0,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_chunks TO authenticated;
GRANT ALL ON public.kb_chunks TO service_role;
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_chunks_admin_all" ON public.kb_chunks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kb_chunks_student_read" ON public.kb_chunks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'student'));

CREATE INDEX IF NOT EXISTS kb_chunks_document_idx ON public.kb_chunks(document_id);
CREATE INDEX IF NOT EXISTS kb_chunks_class_idx ON public.kb_chunks(class_id);
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx
  ON public.kb_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TRIGGER update_kb_documents_updated_at
  BEFORE UPDATE ON public.kb_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Phase 5: ask the teacher ============
CREATE TABLE IF NOT EXISTS public.teacher_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  question text NOT NULL,
  ai_draft text,
  answer text,
  status text NOT NULL DEFAULT 'pending',
  added_to_kb boolean NOT NULL DEFAULT false,
  answered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_questions TO authenticated;
GRANT ALL ON public.teacher_questions TO service_role;
ALTER TABLE public.teacher_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_questions_admin_all" ON public.teacher_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "teacher_questions_student_select" ON public.teacher_questions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "teacher_questions_student_insert" ON public.teacher_questions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_teacher_questions_updated_at
  BEFORE UPDATE ON public.teacher_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Semantic search ============
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 6,
  filter_class_id uuid DEFAULT NULL,
  filter_doc_type text DEFAULT NULL,
  min_similarity double precision DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  title text,
  doc_type text,
  unit text,
  lesson text,
  heading text,
  page_number integer,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_id,
    d.title,
    c.doc_type,
    c.unit,
    c.lesson,
    c.heading,
    c.page_number,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.kb_chunks c
  JOIN public.kb_documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
    AND (filter_class_id IS NULL OR c.class_id IS NULL OR c.class_id = filter_class_id)
    AND (filter_doc_type IS NULL OR c.doc_type = filter_doc_type)
    AND (1 - (c.embedding <=> query_embedding)) >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_kb_chunks(vector, integer, uuid, text, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_kb_chunks(vector, integer, uuid, text, double precision) TO authenticated, service_role;