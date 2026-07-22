
CREATE TABLE public.map_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{"points":[]}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_templates TO authenticated;
GRANT ALL ON public.map_templates TO service_role;

ALTER TABLE public.map_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view map templates"
  ON public.map_templates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert map templates"
  ON public.map_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update map templates"
  ON public.map_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete map templates"
  ON public.map_templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_map_templates_updated_at
  BEFORE UPDATE ON public.map_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_map_templates_created_by ON public.map_templates(created_by);
CREATE INDEX idx_map_templates_category ON public.map_templates(category);
