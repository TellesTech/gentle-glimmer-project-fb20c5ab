-- 1. Manter apenas a linha mais recente em system_settings
DELETE FROM public.system_settings
WHERE id NOT IN (
  SELECT id FROM public.system_settings
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
);

-- 2. Impedir múltiplas linhas no futuro (tabela singleton)
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_singleton
ON public.system_settings ((true));

-- 3. Recriar get_public_branding com ORDER BY explícito
CREATE OR REPLACE FUNCTION public.get_public_branding()
RETURNS TABLE (
  id uuid,
  logo_url text,
  pdf_logo_url text,
  login_logo_url text,
  favicon_url text,
  system_name text,
  system_subtitle text,
  primary_color text,
  accent_color text,
  ai_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, logo_url, pdf_logo_url, login_logo_url, favicon_url,
         system_name, system_subtitle, primary_color, accent_color, ai_avatar_url
  FROM public.system_settings
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_branding() TO anon, authenticated;