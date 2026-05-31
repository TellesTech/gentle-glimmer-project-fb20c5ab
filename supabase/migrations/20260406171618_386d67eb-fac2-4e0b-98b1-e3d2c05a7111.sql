CREATE OR REPLACE FUNCTION public.get_site_collaborators(p_site_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text, job_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.name, p.avatar_url, p.job_title
  FROM profiles p
  JOIN site_responsibles sr ON sr.user_id = p.id
  WHERE sr.site_id = p_site_id
  ORDER BY p.name;
$$;