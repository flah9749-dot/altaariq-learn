-- 1) Scope student access to knowledge base by their own class
DROP POLICY IF EXISTS kb_chunks_student_read ON public.kb_chunks;
CREATE POLICY kb_chunks_student_read ON public.kb_chunks
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'student'::app_role)
  AND (
    class_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = auth.uid() AND s.class_id = kb_chunks.class_id
    )
  )
);

DROP POLICY IF EXISTS kb_documents_student_read ON public.kb_documents;
CREATE POLICY kb_documents_student_read ON public.kb_documents
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'student'::app_role)
  AND (
    class_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = auth.uid() AND s.class_id = kb_documents.class_id
    )
  )
);

-- 2) Tighten publicly readable settings keys
DROP POLICY IF EXISTS "authenticated read public settings" ON public.settings;
CREATE POLICY "authenticated read public settings" ON public.settings
FOR SELECT TO authenticated
USING (
  key LIKE 'exam.%'
  OR key LIKE 'platform.%'
  OR key LIKE 'rewards.%'
  OR key LIKE 'messages.%'
  OR key LIKE 'teacher.%'
  OR key = 'points_config'
);
