-- Function to get eligible supervisors (bypasses RLS)
-- Used by all users to see available supervisors for project/activity assignment
CREATE OR REPLACE FUNCTION get_eligible_supervisors()
RETURNS TABLE (
  id uuid,
  name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.name
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('admin', 'supervisor', 'director', 'super_admin')
  ORDER BY p.name;
$$;

-- Allow authenticated users to execute
GRANT EXECUTE ON FUNCTION get_eligible_supervisors() TO authenticated;