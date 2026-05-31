-- Update get_company_login_contacts: remove user_id filter, add has_auth column
DROP FUNCTION IF EXISTS public.get_company_login_contacts(uuid);
DROP FUNCTION IF EXISTS public.get_company_login_contacts(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_company_login_contacts(p_company_id uuid, p_site_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, name text, email text, role text, avatar_url text, has_pin boolean, has_auth boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cc.id, cc.name, cc.email, cc.role, cc.avatar_url,
         (cc.pin_hash IS NOT NULL AND cc.pin_hash != '') AS has_pin,
         (cc.user_id IS NOT NULL) AS has_auth
  FROM public.company_contacts cc
  WHERE cc.company_id = p_company_id 
    AND cc.is_active = true
    AND (p_site_id IS NULL OR cc.id IN (
      SELECT cs.contact_id FROM public.contact_sites cs WHERE cs.site_id = p_site_id
    ));
$$;

-- Update get_company_login_stats: count ALL projects, not just in_progress
CREATE OR REPLACE FUNCTION public.get_company_login_stats(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  WHERE s.company_id = p_company_id;

  RETURN json_build_object(
    'totalReports', total_reports,
    'totalSignatures', total_signatures,
    'activeProjects', active_projects
  );
END;
$$;

-- Update get_site_login_stats: count ALL projects for the site
CREATE OR REPLACE FUNCTION public.get_site_login_stats(p_site_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'totalReports', (
      SELECT count(*) FROM reports r JOIN projects p ON r.project_id = p.id WHERE p.site_id = p_site_id
    ),
    'totalSignatures', (
      SELECT count(*) FROM autentique_documents ad JOIN reports r ON ad.report_id = r.id JOIN projects p ON r.project_id = p.id WHERE p.site_id = p_site_id AND ad.status = 'signed'
    ),
    'activeProjects', (
      SELECT count(*) FROM projects p WHERE p.site_id = p_site_id
    )
  ) INTO result;
  RETURN result;
END;
$$;