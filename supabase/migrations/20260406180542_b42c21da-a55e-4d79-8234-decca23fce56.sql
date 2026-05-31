CREATE OR REPLACE FUNCTION public.get_portal_collaborator(p_profile_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text, job_title text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.avatar_url, p.job_title
  FROM profiles p
  WHERE p.id = p_profile_id
  LIMIT 1;
$$;