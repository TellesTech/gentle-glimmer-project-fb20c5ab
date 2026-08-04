CREATE OR REPLACE FUNCTION public.get_portal_wees_responsibles(_company_id uuid)
 RETURNS TABLE(id uuid, name text, job_title text, avatar_url text, has_signature boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR _company_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.has_role(v_user, 'super_admin'::user_role)
    OR public.has_role(v_user, 'admin'::user_role)
    OR public.get_user_company_id(v_user) = _company_id
    OR EXISTS (SELECT 1 FROM public.client_profiles cp WHERE cp.user_id = v_user AND cp.is_active = true AND cp.company_id = _company_id)
    OR EXISTS (SELECT 1 FROM public.company_contacts cc WHERE cc.user_id = v_user AND cc.is_active = true AND cc.company_id = _company_id)
    OR EXISTS (SELECT 1 FROM public.portal_admin_access paa JOIN public.sites s ON s.id = paa.site_id WHERE paa.user_id = v_user AND s.company_id = _company_id)
    OR EXISTS (SELECT 1 FROM public.site_responsibles sr JOIN public.sites s ON s.id = sr.site_id WHERE sr.user_id = v_user AND s.company_id = _company_id)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH wees_users AS (
    SELECT DISTINCT u.user_id
    FROM (
      SELECT paa.user_id, paa.site_id FROM public.portal_admin_access paa
      UNION
      SELECT sr.user_id, sr.site_id FROM public.site_responsibles sr
    ) u
    JOIN public.sites s ON s.id = u.site_id
    WHERE s.company_id = _company_id AND u.user_id IS NOT NULL
  ),
  company_reports AS (
    SELECT r.id
    FROM public.reports r
    JOIN public.projects p ON p.id = r.project_id
    JOIN public.sites s ON s.id = p.site_id
    WHERE s.company_id = _company_id
  )
  SELECT p.id, COALESCE(p.name, 'Sem nome'), p.job_title, p.avatar_url, (p.signature_data IS NOT NULL)
  FROM public.profiles p
  JOIN wees_users wu ON wu.user_id = p.id
  WHERE p.signature_data IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM public.report_signatures rs
       JOIN company_reports cr ON cr.id = rs.report_id
       WHERE rs.signer_user_id = p.id
     )
  ORDER BY p.name;
END;
$function$;