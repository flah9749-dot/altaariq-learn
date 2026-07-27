-- 1) Prevent duplicate FCM tokens across devices/reinstalls
DELETE FROM public.push_tokens a
USING public.push_tokens b
WHERE a.ctid < b.ctid AND a.token = b.token;

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_uniq ON public.push_tokens(token);

-- 2) Announcement notifications only on INSERT (updates were re-firing)
DROP TRIGGER IF EXISTS trg_notify_on_announcement ON public.announcements;
DROP TRIGGER IF EXISTS notify_on_announcement_trigger ON public.announcements;
CREATE TRIGGER trg_notify_on_announcement
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_announcement();

-- 3) Allow students to see active competitions and join
DROP POLICY IF EXISTS "students_read_active_competitions" ON public.competitions;
CREATE POLICY "students_read_active_competitions" ON public.competitions
  FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "students_join_competitions" ON public.competition_participants;
CREATE POLICY "students_join_competitions" ON public.competition_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "students_read_own_participation" ON public.competition_participants;
CREATE POLICY "students_read_own_participation" ON public.competition_participants
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );