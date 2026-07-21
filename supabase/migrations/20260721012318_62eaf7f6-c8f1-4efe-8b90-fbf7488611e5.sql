INSERT INTO public.ai_providers (slug, name, enabled, priority, secret_name, default_model)
VALUES ('lovable', 'Lovable AI Gateway', true, 0, 'LOVABLE_API_KEY', 'google/gemini-3.5-flash')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  secret_name = EXCLUDED.secret_name,
  default_model = COALESCE(public.ai_providers.default_model, EXCLUDED.default_model);