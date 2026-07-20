
-- Phase 6: Gamification schema

-- Extend points_log for detailed tracking
ALTER TABLE public.points_log
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'earn' CHECK (kind IN ('earn','deduct')),
  ADD COLUMN IF NOT EXISTS ref_type text,
  ADD COLUMN IF NOT EXISTS ref_id uuid,
  ADD COLUMN IF NOT EXISTS awarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Point rules (configurable point values)
CREATE TABLE IF NOT EXISTS public.point_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'earn' CHECK (kind IN ('earn','deduct')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.point_rules TO authenticated;
GRANT ALL ON public.point_rules TO service_role;
ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.point_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.point_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Levels
CREATE TABLE IF NOT EXISTS public.levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index integer NOT NULL,
  name text NOT NULL,
  min_points integer NOT NULL DEFAULT 0,
  icon text,
  color text DEFAULT '#1e293b',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.levels TO authenticated;
GRANT ALL ON public.levels TO service_role;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.levels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Badges
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'award',
  color text DEFAULT '#f59e0b',
  condition_type text,
  condition_value integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.student_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, badge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_badges TO authenticated;
GRANT ALL ON public.student_badges TO service_role;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.student_badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student_read_own" ON public.student_badges FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- Achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'trophy',
  color text DEFAULT '#10b981',
  condition_type text,
  condition_value integer DEFAULT 1,
  points_reward integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.achievements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.student_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, achievement_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_achievements TO authenticated;
GRANT ALL ON public.student_achievements TO service_role;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.student_achievements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student_read_own" ON public.student_achievements FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- Reward catalog (shop items)
CREATE TABLE IF NOT EXISTS public.reward_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  points_cost integer NOT NULL DEFAULT 100,
  stock integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_catalog TO authenticated;
GRANT ALL ON public.reward_catalog TO service_role;
ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.reward_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.reward_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Reward redemptions
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.reward_catalog(id) ON DELETE RESTRICT,
  points_spent integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.reward_redemptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student_read_own" ON public.reward_redemptions FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE POLICY "student_insert_own" ON public.reward_redemptions FOR INSERT TO authenticated
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- Competitions
CREATE TABLE IF NOT EXISTS public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'weekly' CHECK (type IN ('daily','weekly','monthly','custom')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  winners_count integer NOT NULL DEFAULT 3,
  prize text,
  bonus_points integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.competitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.competitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.competition_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  rank integer,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competition_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_participants TO authenticated;
GRANT ALL ON public.competition_participants TO service_role;
ALTER TABLE public.competition_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.competition_participants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student_read_own" ON public.competition_participants FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- Update-timestamp triggers
CREATE TRIGGER trg_point_rules_upd BEFORE UPDATE ON public.point_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_levels_upd BEFORE UPDATE ON public.levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_badges_upd BEFORE UPDATE ON public.badges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_reward_catalog_upd BEFORE UPDATE ON public.reward_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_reward_redemptions_upd BEFORE UPDATE ON public.reward_redemptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_competitions_upd BEFORE UPDATE ON public.competitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: recompute a student's level from levels table & their points
CREATE OR REPLACE FUNCTION public.recompute_student_level(_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_level integer;
  cur_points integer;
BEGIN
  SELECT points INTO cur_points FROM public.students WHERE id = _student_id;
  SELECT COALESCE(MAX(order_index), 1) INTO new_level
    FROM public.levels
    WHERE active = true AND min_points <= COALESCE(cur_points, 0);
  UPDATE public.students SET level = new_level WHERE id = _student_id;
END;
$$;

-- Trigger: on points_log insert, mutate student's points balance and level
CREATE OR REPLACE FUNCTION public.apply_points_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.students
    SET points = GREATEST(0, COALESCE(points,0) + NEW.points)
    WHERE id = NEW.student_id;
  PERFORM public.recompute_student_level(NEW.student_id);
  -- notify
  INSERT INTO public.notifications(user_id, title, body, type, link)
  SELECT s.user_id,
    CASE WHEN NEW.points >= 0 THEN '⭐ حصلت على نقاط' ELSE '⚠️ تم خصم نقاط' END,
    COALESCE(NEW.reason,'') || ' (' || NEW.points || ')',
    'points', '/student/points'
  FROM public.students s WHERE s.id = NEW.student_id AND s.user_id IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_points ON public.points_log;
CREATE TRIGGER trg_apply_points AFTER INSERT ON public.points_log
FOR EACH ROW EXECUTE FUNCTION public.apply_points_change();

-- Seed default point rules
INSERT INTO public.point_rules (key, label, points, kind) VALUES
  ('exam_completed','إتمام امتحان', 10, 'earn'),
  ('exam_passed','النجاح في الامتحان', 20, 'earn'),
  ('exam_perfect','الحصول على الدرجة النهائية', 50, 'earn'),
  ('exam_early_finish','إنهاء الامتحان مبكرًا', 5, 'earn'),
  ('daily_login','الدخول اليومي للمنصة', 2, 'earn'),
  ('competition_join','المشاركة في مسابقة', 5, 'earn'),
  ('badge_earned','الحصول على شارة', 15, 'earn'),
  ('homework_done','تنفيذ واجب', 10, 'earn'),
  ('cheating_detected','الغش', -50, 'deduct'),
  ('exam_leave_page','مغادرة صفحة الامتحان', -5, 'deduct'),
  ('late_submission','التأخر في أداء الامتحان', -10, 'deduct'),
  ('rule_violation','مخالفة قواعد المنصة', -20, 'deduct')
ON CONFLICT (key) DO NOTHING;

-- Seed default levels
INSERT INTO public.levels (order_index, name, min_points, icon, color) VALUES
  (1,'مبتدئ',0,'sprout','#94a3b8'),
  (2,'مستكشف',100,'compass','#3b82f6'),
  (3,'باحث',300,'search','#8b5cf6'),
  (4,'مؤرخ',600,'book','#a855f7'),
  (5,'جغرافي',1000,'globe','#0ea5e9'),
  (6,'عالم حضارات',1500,'landmark','#f59e0b'),
  (7,'قائد المعرفة',2200,'crown','#ef4444'),
  (8,'بطل الطارق',3000,'trophy','#eab308')
ON CONFLICT DO NOTHING;

-- Seed default achievements
INSERT INTO public.achievements (key, name, description, icon, condition_type, condition_value, points_reward) VALUES
  ('first_login','أول تسجيل دخول','بداية الرحلة','log-in','login_count',1,5),
  ('first_exam','أول امتحان','أنجزت أول امتحان','file-check','exam_count',1,10),
  ('exams_5','خمس امتحانات','أتممت 5 امتحانات','files','exam_count',5,25),
  ('exams_10','عشر امتحانات','أتممت 10 امتحانات','clipboard-check','exam_count',10,50),
  ('points_1000','ألف نقطة','بلغت 1000 نقطة','star','points',1000,100)
ON CONFLICT (key) DO NOTHING;

-- Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.points_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_badges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_achievements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_redemptions;
