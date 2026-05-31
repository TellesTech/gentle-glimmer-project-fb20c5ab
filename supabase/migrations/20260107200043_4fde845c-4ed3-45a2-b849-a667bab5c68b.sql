-- Fix SECURITY DEFINER view warning by adding SECURITY INVOKER
DROP VIEW IF EXISTS public.public_system_branding;

CREATE VIEW public.public_system_branding 
WITH (security_invoker = true) AS
SELECT 
  id,
  system_name,
  system_subtitle,
  logo_url,
  login_logo_url,
  pdf_logo_url,
  favicon_url,
  primary_color,
  accent_color,
  ai_avatar_url
FROM system_settings
LIMIT 1;

-- Grant public access to the view
GRANT SELECT ON public.public_system_branding TO anon, authenticated;