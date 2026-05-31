
-- 1. Create helper function that returns ALL report IDs for a company contact's company
CREATE OR REPLACE FUNCTION public.get_company_contact_report_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id FROM public.reports r
  JOIN public.projects p ON p.id = r.project_id
  JOIN public.sites s ON s.id = p.site_id
  WHERE s.company_id IN (
    SELECT company_id FROM public.company_contacts WHERE user_id = _user_id AND is_active = true
  )
$$;

-- 2. Create helper function for company contact project IDs (by company, not by approver)
CREATE OR REPLACE FUNCTION public.get_company_contact_project_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id FROM public.projects p
  JOIN public.sites s ON s.id = p.site_id
  WHERE s.company_id IN (
    SELECT company_id FROM public.company_contacts WHERE user_id = _user_id AND is_active = true
  )
$$;

-- 3. Drop existing company contact RLS policies and recreate with new logic

-- reports
DROP POLICY IF EXISTS "Company contacts can view assigned reports" ON public.reports;
CREATE POLICY "Company contacts can view company reports"
  ON public.reports FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    id IN (SELECT get_company_contact_report_ids(auth.uid()))
  );

-- report_activities
DROP POLICY IF EXISTS "Company contacts can view assigned report activities" ON public.report_activities;
CREATE POLICY "Company contacts can view company report activities"
  ON public.report_activities FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_company_contact_report_ids(auth.uid()))
  );

-- report_attendance
DROP POLICY IF EXISTS "Company contacts can view assigned report attendance" ON public.report_attendance;
CREATE POLICY "Company contacts can view company report attendance"
  ON public.report_attendance FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_company_contact_report_ids(auth.uid()))
  );

-- report_deviations
DROP POLICY IF EXISTS "Company contacts can view assigned report deviations" ON public.report_deviations;
CREATE POLICY "Company contacts can view company report deviations"
  ON public.report_deviations FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_company_contact_report_ids(auth.uid()))
  );

-- report_equipment
DROP POLICY IF EXISTS "Company contacts can view assigned report equipment" ON public.report_equipment;
CREATE POLICY "Company contacts can view company report equipment"
  ON public.report_equipment FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_company_contact_report_ids(auth.uid()))
  );

-- report_photos
DROP POLICY IF EXISTS "Company contacts can view assigned report photos" ON public.report_photos;
CREATE POLICY "Company contacts can view company report photos"
  ON public.report_photos FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_company_contact_report_ids(auth.uid()))
  );

-- report_signatures
DROP POLICY IF EXISTS "Company contacts can view assigned report signatures" ON public.report_signatures;
CREATE POLICY "Company contacts can view company report signatures"
  ON public.report_signatures FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_company_contact_report_ids(auth.uid()))
  );

-- projects
DROP POLICY IF EXISTS "Company contacts can view related projects" ON public.projects;
CREATE POLICY "Company contacts can view company projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    id IN (SELECT get_company_contact_project_ids(auth.uid()))
  );

-- companies
DROP POLICY IF EXISTS "Company contacts can view related companies" ON public.companies;
CREATE POLICY "Company contacts can view their company"
  ON public.companies FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    id IN (SELECT company_id FROM public.company_contacts WHERE user_id = auth.uid() AND is_active = true)
  );

-- sites
DROP POLICY IF EXISTS "Company contacts can view related sites" ON public.sites;
CREATE POLICY "Company contacts can view company sites"
  ON public.sites FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    company_id IN (SELECT company_id FROM public.company_contacts WHERE user_id = auth.uid() AND is_active = true)
  );

-- report_company_approvers: allow contacts to INSERT/UPDATE their own approver records
DROP POLICY IF EXISTS "Company contacts can view own approver records" ON public.report_company_approvers;
CREATE POLICY "Company contacts can view own approver records"
  ON public.report_company_approvers FOR SELECT TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    contact_id = get_company_contact_id(auth.uid())
  );

DROP POLICY IF EXISTS "Company contacts can insert own approver records" ON public.report_company_approvers;
CREATE POLICY "Company contacts can insert own approver records"
  ON public.report_company_approvers FOR INSERT TO authenticated
  WITH CHECK (
    is_company_contact(auth.uid()) AND
    contact_id = get_company_contact_id(auth.uid())
  );

DROP POLICY IF EXISTS "Company contacts can update own approver records" ON public.report_company_approvers;
CREATE POLICY "Company contacts can update own approver records"
  ON public.report_company_approvers FOR UPDATE TO authenticated
  USING (
    is_company_contact(auth.uid()) AND
    contact_id = get_company_contact_id(auth.uid())
  );

-- report_signatures: allow company contacts to INSERT signatures
DROP POLICY IF EXISTS "Company contacts can insert signatures" ON public.report_signatures;
CREATE POLICY "Company contacts can insert signatures"
  ON public.report_signatures FOR INSERT TO authenticated
  WITH CHECK (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_company_contact_report_ids(auth.uid()))
  );
