
ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS class_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS group_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_question_bank_class_ids ON public.question_bank USING gin (class_ids);
CREATE INDEX IF NOT EXISTS idx_question_bank_group_ids ON public.question_bank USING gin (group_ids);

DROP POLICY IF EXISTS "Students read visible question_bank" ON public.question_bank;

CREATE POLICY "Students read visible question_bank"
ON public.question_bank
FOR SELECT
TO authenticated
USING (
  visibility = 'students'
  AND EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
      AND (
        COALESCE(array_length(question_bank.class_ids, 1), 0) = 0
        OR s.class_id = ANY (question_bank.class_ids)
      )
      AND (
        COALESCE(array_length(question_bank.group_ids, 1), 0) = 0
        OR s.group_id = ANY (question_bank.group_ids)
      )
  )
);
