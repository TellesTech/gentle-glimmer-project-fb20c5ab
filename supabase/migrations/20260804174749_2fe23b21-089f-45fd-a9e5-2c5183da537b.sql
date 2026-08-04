CREATE OR REPLACE FUNCTION public.get_site_login_stats(p_site_id uuid)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH visible AS (
    SELECT r.id, p.id AS project_id
    FROM public.reports r
    JOIN public.projects p ON p.id = r.project_id
    WHERE p.site_id = p_site_id
      AND r.status <> 'draft'
      AND NOT EXISTS (
        SELECT 1 FROM public.portal_hidden_months hm
        WHERE hm.site_id = p.site_id
          AND hm.year = EXTRACT(YEAR FROM r.date)::int
          AND hm.month = EXTRACT(MONTH FROM r.date)::int - 1
      )
  )
  SELECT json_build_object(
    'totalReports', (SELECT count(*) FROM visible),
    'totalSignatures', (
      SELECT count(*) FROM public.report_signatures rs
      JOIN visible v ON v.id = rs.report_id
      WHERE rs.signed_at IS NOT NULL
    ),
    'activeProjects', (SELECT count(DISTINCT project_id) FROM visible)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_company_login_stats(p_company_id uuid)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH visible AS (
    SELECT r.id, p.id AS project_id
    FROM public.reports r
    JOIN public.projects p ON p.id = r.project_id
    JOIN public.sites s ON s.id = p.site_id
    WHERE s.company_id = p_company_id
      AND r.status <> 'draft'
      AND NOT EXISTS (
        SELECT 1 FROM public.portal_hidden_months hm
        WHERE hm.site_id = p.site_id
          AND hm.year = EXTRACT(YEAR FROM r.date)::int
          AND hm.month = EXTRACT(MONTH FROM r.date)::int - 1
      )
  )
  SELECT json_build_object(
    'totalReports', (SELECT count(*) FROM visible),
    'totalSignatures', (
      SELECT count(*) FROM public.report_signatures rs
      JOIN visible v ON v.id = rs.report_id
      WHERE rs.signed_at IS NOT NULL
    ),
    'activeProjects', (SELECT count(DISTINCT project_id) FROM visible)
  );
$function$;