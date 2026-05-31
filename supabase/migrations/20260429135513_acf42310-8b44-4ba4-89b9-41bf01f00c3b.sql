
-- 1) Helper function: user_has_site_access
CREATE OR REPLACE FUNCTION public.user_has_site_access(_user_id uuid, _site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _site_id IS NOT NULL
    AND (
      has_role(_user_id, 'super_admin'::user_role)
      OR EXISTS (
        SELECT 1 FROM public.sites s
        WHERE s.id = _site_id
          AND s.company_id = get_user_company_id(_user_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.portal_admin_access paa
        WHERE paa.user_id = _user_id AND paa.site_id = _site_id
      )
      OR EXISTS (
        SELECT 1 FROM public.site_responsibles sr
        WHERE sr.user_id = _user_id AND sr.site_id = _site_id
      )
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.site_id = _site_id
          AND p.id IN (SELECT get_user_project_ids(_user_id))
      )
    )
$$;

-- 2) Update user_has_project_access to also consider site-level access
CREATE OR REPLACE FUNCTION public.user_has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = _project_id
    AND (
      has_role(_user_id, 'super_admin'::user_role)
      OR p.company_id = get_user_company_id(_user_id)
      OR _project_id IN (SELECT get_user_project_ids(_user_id))
      OR public.user_has_site_access(_user_id, p.site_id)
    )
  )
$$;

-- 3) Recreate RLS policies on service_reports
DROP POLICY IF EXISTS "Users can view service reports they have access to" ON public.service_reports;
DROP POLICY IF EXISTS "Users can insert service reports they have access to" ON public.service_reports;
DROP POLICY IF EXISTS "Users can update service reports they have access to" ON public.service_reports;
DROP POLICY IF EXISTS "Users can delete service reports they have access to" ON public.service_reports;

CREATE POLICY "Users can view service reports they have access to"
ON public.service_reports FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR (company_id IS NOT NULL AND company_id = get_user_company_id(auth.uid()))
  OR (site_id IS NOT NULL AND public.user_has_site_access(auth.uid(), site_id))
  OR (project_id IS NOT NULL AND public.user_has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can insert service reports they have access to"
ON public.service_reports FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR (company_id IS NOT NULL AND company_id = get_user_company_id(auth.uid()))
  OR (site_id IS NOT NULL AND public.user_has_site_access(auth.uid(), site_id))
  OR (project_id IS NOT NULL AND public.user_has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can update service reports they have access to"
ON public.service_reports FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR (company_id IS NOT NULL AND company_id = get_user_company_id(auth.uid()))
  OR (site_id IS NOT NULL AND public.user_has_site_access(auth.uid(), site_id))
  OR (project_id IS NOT NULL AND public.user_has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR (company_id IS NOT NULL AND company_id = get_user_company_id(auth.uid()))
  OR (site_id IS NOT NULL AND public.user_has_site_access(auth.uid(), site_id))
  OR (project_id IS NOT NULL AND public.user_has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can delete service reports they have access to"
ON public.service_reports FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::user_role)
  OR (company_id IS NOT NULL AND company_id = get_user_company_id(auth.uid()))
  OR (site_id IS NOT NULL AND public.user_has_site_access(auth.uid(), site_id))
  OR (project_id IS NOT NULL AND public.user_has_project_access(auth.uid(), project_id))
);

-- 4) Recreate RLS policies on child tables to inherit from parent
DROP POLICY IF EXISTS "Users can manage sections of accessible reports" ON public.service_report_sections;
CREATE POLICY "Users can manage sections of accessible reports"
ON public.service_report_sections FOR ALL TO authenticated
USING (
  report_id IN (
    SELECT sr.id FROM public.service_reports sr
    WHERE has_role(auth.uid(), 'super_admin'::user_role)
       OR (sr.company_id IS NOT NULL AND sr.company_id = get_user_company_id(auth.uid()))
       OR (sr.site_id IS NOT NULL AND public.user_has_site_access(auth.uid(), sr.site_id))
       OR (sr.project_id IS NOT NULL AND public.user_has_project_access(auth.uid(), sr.project_id))
  )
)
WITH CHECK (
  report_id IN (
    SELECT sr.id FROM public.service_reports sr
    WHERE has_role(auth.uid(), 'super_admin'::user_role)
       OR (sr.company_id IS NOT NULL AND sr.company_id = get_user_company_id(auth.uid()))
       OR (sr.site_id IS NOT NULL AND public.user_has_site_access(auth.uid(), sr.site_id))
       OR (sr.project_id IS NOT NULL AND public.user_has_project_access(auth.uid(), sr.project_id))
  )
);

DROP POLICY IF EXISTS "Users can manage photos of accessible sections" ON public.service_report_photos;
CREATE POLICY "Users can manage photos of accessible sections"
ON public.service_report_photos FOR ALL TO authenticated
USING (
  section_id IN (
    SELECT s.id FROM public.service_report_sections s
    JOIN public.service_reports sr ON sr.id = s.report_id
    WHERE has_role(auth.uid(), 'super_admin'::user_role)
       OR (sr.company_id IS NOT NULL AND sr.company_id = get_user_company_id(auth.uid()))
       OR (sr.site_id IS NOT NULL AND public.user_has_site_access(auth.uid(), sr.site_id))
       OR (sr.project_id IS NOT NULL AND public.user_has_project_access(auth.uid(), sr.project_id))
  )
)
WITH CHECK (
  section_id IN (
    SELECT s.id FROM public.service_report_sections s
    JOIN public.service_reports sr ON sr.id = s.report_id
    WHERE has_role(auth.uid(), 'super_admin'::user_role)
       OR (sr.company_id IS NOT NULL AND sr.company_id = get_user_company_id(auth.uid()))
       OR (sr.site_id IS NOT NULL AND public.user_has_site_access(auth.uid(), sr.site_id))
       OR (sr.project_id IS NOT NULL AND public.user_has_project_access(auth.uid(), sr.project_id))
  )
);
