CREATE OR REPLACE FUNCTION public.get_quick_access_users()
RETURNS TABLE(id uuid, name text, avatar_url text, has_pin boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id,
    name,
    avatar_url,
    true as has_pin
  FROM profiles
  WHERE pin_hash IS NOT NULL AND pin_hash != ''
  ORDER BY name;
$$;