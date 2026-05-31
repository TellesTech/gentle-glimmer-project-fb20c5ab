CREATE OR REPLACE FUNCTION public.get_site_collaborators(p_site_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text, job_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.name, p.avatar_url, p.job_title
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('admin', 'super_admin')
    AND p.job_title IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM site_responsibles sr WHERE sr.user_id = p.id AND sr.site_id = p_site_id)
      OR EXISTS (
        SELECT 1 FROM reports r 
        JOIN projects pr ON pr.id = r.project_id 
        WHERE r.created_by = p.id AND pr.site_id = p_site_id
      )
      OR EXISTS (
        SELECT 1 FROM project_members pm 
        JOIN projects pr ON pr.id = pm.project_id 
        WHERE pm.profile_id = p.id AND pr.site_id = p_site_id
      )
    )
  ORDER BY p.name;
$$;