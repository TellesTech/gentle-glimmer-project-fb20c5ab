-- Add global toggle for the WEX rewards program
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS rewards_enabled boolean NOT NULL DEFAULT true;

-- Function signature changes (added new return column), so drop & recreate
DROP FUNCTION IF EXISTS public.get_public_branding();

CREATE OR REPLACE FUNCTION public.get_public_branding()
 RETURNS TABLE(id uuid, system_name text, system_subtitle text, logo_url text, login_logo_url text, pdf_logo_url text, favicon_url text, primary_color text, accent_color text, ai_avatar_url text, rewards_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ai_avatar_url,
    COALESCE(rewards_enabled, true) AS rewards_enabled
  FROM public.system_settings
  LIMIT 1;
$function$;