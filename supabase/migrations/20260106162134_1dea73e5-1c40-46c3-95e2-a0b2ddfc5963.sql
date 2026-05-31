-- Function to get users with PIN configured for quick access login
-- Uses SECURITY DEFINER to bypass RLS since this is called before authentication
CREATE OR REPLACE FUNCTION get_quick_access_users()
RETURNS TABLE (
  id uuid,
  name text,
  avatar_url text,
  has_pin boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    name,
    avatar_url,
    true as has_pin
  FROM profiles
  WHERE pin_hash IS NOT NULL
  ORDER BY name
  LIMIT 20;
$$;

-- Allow anonymous and authenticated users to execute this function
GRANT EXECUTE ON FUNCTION get_quick_access_users() TO anon;
GRANT EXECUTE ON FUNCTION get_quick_access_users() TO authenticated;