
CREATE OR REPLACE FUNCTION public.get_company_login_stats(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_reports INTEGER;
  total_signatures INTEGER;
  active_projects INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_reports
  FROM reports r
  JOIN projects p ON r.project_id = p.id
  JOIN sites s ON p.site_id = s.id
  WHERE s.company_id = p_company_id;

  SELECT COUNT(*) INTO total_signatures
  FROM clicksign_documents cd
  JOIN reports r ON cd.report_id = r.id
  JOIN projects p ON r.project_id = p.id
  JOIN sites s ON p.site_id = s.id
  WHERE s.company_id = p_company_id;

  SELECT COUNT(*) INTO active_projects
  FROM projects p
  JOIN sites s ON p.site_id = s.id
  WHERE s.company_id = p_company_id AND p.status = 'in_progress';

  RETURN json_build_object(
    'totalReports', total_reports,
    'totalSignatures', total_signatures,
    'activeProjects', active_projects
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_login_stats(uuid) TO anon, authenticated;
