
CREATE OR REPLACE FUNCTION public.get_site_login_stats(p_site_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'totalReports', (
      SELECT count(*)
      FROM reports r
      JOIN projects p ON r.project_id = p.id
      WHERE p.site_id = p_site_id
    ),
    'totalSignatures', (
      SELECT count(*)
      FROM autentique_documents ad
      JOIN reports r ON ad.report_id = r.id
      JOIN projects p ON r.project_id = p.id
      WHERE p.site_id = p_site_id AND ad.status = 'signed'
    ),
    'activeProjects', (
      SELECT count(*)
      FROM projects p
      WHERE p.site_id = p_site_id AND p.status = 'in_progress'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;
