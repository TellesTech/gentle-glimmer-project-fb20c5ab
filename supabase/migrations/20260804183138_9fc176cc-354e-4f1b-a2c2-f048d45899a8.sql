CREATE OR REPLACE FUNCTION public.portal_user_site_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cs.site_id
  FROM public.contact_sites cs
  JOIN public.company_contacts cc ON cc.id = cs.contact_id
  WHERE cc.user_id = _user_id AND COALESCE(cc.is_active, true) = true
  UNION
  SELECT cls.site_id
  FROM public.client_sites cls
  JOIN public.client_profiles cp ON cp.id = cls.client_id
  WHERE cp.user_id = _user_id AND COALESCE(cp.is_active, true) = true
  UNION
  SELECT s.id
  FROM public.sites s
  JOIN public.company_contacts cc ON cc.company_id = s.company_id
  WHERE cc.user_id = _user_id AND COALESCE(cc.is_active, true) = true
    AND NOT EXISTS (SELECT 1 FROM public.contact_sites cs2 WHERE cs2.contact_id = cc.id)
  UNION
  SELECT s.id
  FROM public.sites s
  JOIN public.client_profiles cp ON cp.company_id = s.company_id
  WHERE cp.user_id = _user_id AND COALESCE(cp.is_active, true) = true
    AND NOT EXISTS (SELECT 1 FROM public.client_sites cs3 WHERE cs3.client_id = cp.id)
$$;

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
      AND r.status IN ('signed'::report_status, 'finalized'::report_status)
      AND p.site_id IN (SELECT public.portal_user_site_ids(_user_id))
      AND NOT EXISTS (
        SELECT 1 FROM public.portal_hidden_months hm
        WHERE hm.site_id = p.site_id
          AND hm.year = EXTRACT(YEAR FROM r.date)::int
          AND hm.month = EXTRACT(MONTH FROM r.date)::int - 1
      )
  )
$$;

DROP POLICY IF EXISTS "Portal users can view unit reports" ON public.reports;
CREATE POLICY "Portal users can view unit reports"
ON public.reports FOR SELECT TO authenticated
USING (public.can_view_portal_report(auth.uid(), id));

DROP POLICY IF EXISTS "Portal users can view unit report photos" ON public.report_photos;
CREATE POLICY "Portal users can view unit report photos"
ON public.report_photos FOR SELECT TO authenticated
USING (public.can_view_portal_report(auth.uid(), report_id));

DROP POLICY IF EXISTS "Portal users can view unit report activities" ON public.report_activities;
CREATE POLICY "Portal users can view unit report activities"
ON public.report_activities FOR SELECT TO authenticated
USING (public.can_view_portal_report(auth.uid(), report_id));

DROP POLICY IF EXISTS "Portal users can view unit activity steps" ON public.report_activity_steps;
CREATE POLICY "Portal users can view unit activity steps"
ON public.report_activity_steps FOR SELECT TO authenticated
USING (public.can_view_portal_report(auth.uid(), report_id));

DROP POLICY IF EXISTS "Portal users can view unit attendance" ON public.report_attendance;
CREATE POLICY "Portal users can view unit attendance"
ON public.report_attendance FOR SELECT TO authenticated
USING (public.can_view_portal_report(auth.uid(), report_id));

DROP POLICY IF EXISTS "Portal users can view unit report equipment" ON public.report_equipment;
CREATE POLICY "Portal users can view unit report equipment"
ON public.report_equipment FOR SELECT TO authenticated
USING (public.can_view_portal_report(auth.uid(), report_id));

DROP POLICY IF EXISTS "Portal users can view unit report deviations" ON public.report_deviations;
CREATE POLICY "Portal users can view unit report deviations"
ON public.report_deviations FOR SELECT TO authenticated
USING (public.can_view_portal_report(auth.uid(), report_id));

DROP POLICY IF EXISTS "Portal users can view unit report signatures" ON public.report_signatures;
CREATE POLICY "Portal users can view unit report signatures"
ON public.report_signatures FOR SELECT TO authenticated
USING (public.can_view_portal_report(auth.uid(), report_id));

DROP POLICY IF EXISTS "Portal users can view unit projects" ON public.projects;
CREATE POLICY "Portal users can view unit projects"
ON public.projects FOR SELECT TO authenticated
USING (site_id IN (SELECT public.portal_user_site_ids(auth.uid())));

DROP POLICY IF EXISTS "Portal users can view their sites" ON public.sites;
CREATE POLICY "Portal users can view their sites"
ON public.sites FOR SELECT TO authenticated
USING (id IN (SELECT public.portal_user_site_ids(auth.uid())));