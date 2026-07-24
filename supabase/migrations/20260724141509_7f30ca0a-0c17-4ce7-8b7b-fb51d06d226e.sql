
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid,
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Update helper functions to exclude inactive profiles
CREATE OR REPLACE FUNCTION public.get_eligible_supervisors()
 RETURNS TABLE(id uuid, name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.id, p.name
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('admin', 'supervisor', 'director', 'super_admin')
    AND COALESCE(p.is_active, true) = true
  ORDER BY p.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_quick_access_users()
 RETURNS TABLE(id uuid, name text, avatar_url text, has_pin boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id,
    name,
    avatar_url,
    true as has_pin
  FROM profiles
  WHERE pin_hash IS NOT NULL AND pin_hash != ''
    AND COALESCE(is_active, true) = true
  ORDER BY name;
$function$;
