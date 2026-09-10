CREATE OR REPLACE FUNCTION public.can_view_portal_report(_user_id uuid, _report_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.reports r
    JOIN public.projects p ON p.id = r.project_id
    WHERE r.id = _report_id
      AND r.status IN ('sent'::report_status, 'signed'::report_status, 'finalized'::report_status)
      AND p.site_id IN (SELECT public.portal_user_site_ids(_user_id))
      AND (
        EXISTS (
          SELECT 1 FROM public.report_company_approvers rca
          JOIN public.company_contacts cc ON cc.id = rca.contact_id
          WHERE rca.report_id = r.id AND cc.user_id = _user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.report_client_approvers rcl
          JOIN public.client_profiles cp ON cp.id = rcl.client_id
          WHERE rcl.report_id = r.id AND cp.user_id = _user_id
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.portal_hidden_months hm
        WHERE hm.site_id = p.site_id
          AND hm.year = EXTRACT(YEAR FROM r.date)::int
          AND hm.month = EXTRACT(MONTH FROM r.date)::int - 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.portal_hidden_reports hr
        WHERE hr.report_id = r.id
      )
  )
$function$;