-- Create function with SECURITY DEFINER to bypass RLS for public branding
CREATE OR REPLACE FUNCTION public.get_public_branding()
RETURNS TABLE (
  id uuid,
  system_name text,
  system_subtitle text,
  logo_url text,
  login_logo_url text,
  pdf_logo_url text,
  favicon_url text,
  primary_color text,
  accent_color text,
  ai_avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
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
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_public_branding() TO anon, authenticated;