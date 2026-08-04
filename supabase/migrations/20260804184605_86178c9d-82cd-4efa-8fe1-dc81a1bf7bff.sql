CREATE OR REPLACE FUNCTION public.can_view_portal_report(_user_id uuid, _report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reports r
    JOIN public.projects p ON p.id = r.project_id
    WHERE r.id = _report_id
      AND r.status IN ('sent'::report_status, 'signed'::report_status, 'finalized'::report_status)
      AND p.site_id IN (SELECT public.portal_user_site_ids(_user_id))
      AND NOT EXISTS (
        SELECT 1 FROM public.portal_hidden_months hm
        WHERE hm.site_id = p.site_id
          AND hm.year = EXTRACT(YEAR FROM r.date)::int
          AND hm.month = EXTRACT(MONTH FROM r.date)::int - 1
      )
  )
$$;