
-- Helper: check if user is a company contact
CREATE OR REPLACE FUNCTION public.is_company_contact(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_contacts
    WHERE user_id = _user_id AND is_active = true
  )
$$;

-- Helper: get company_contact id for a user
CREATE OR REPLACE FUNCTION public.get_company_contact_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.company_contacts
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Helper: get report ids accessible to a company contact
CREATE OR REPLACE FUNCTION public.get_contact_report_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT report_id FROM public.report_company_approvers
  WHERE contact_id IN (
    SELECT id FROM public.company_contacts WHERE user_id = _user_id
  )
$$;

-- Helper: get project ids accessible to a company contact
CREATE OR REPLACE FUNCTION public.get_contact_project_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT r.project_id FROM public.reports r
  JOIN public.report_company_approvers rca ON rca.report_id = r.id
  WHERE rca.contact_id IN (
    SELECT id FROM public.company_contacts WHERE user_id = _user_id
  )
$$;

-- reports: allow company contacts to view assigned reports
CREATE POLICY "Company contacts can view assigned reports"
  ON public.reports FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    id IN (SELECT get_contact_report_ids(auth.uid()))
  );

-- report_activities
CREATE POLICY "Company contacts can view assigned report activities"
  ON public.report_activities FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_contact_report_ids(auth.uid()))
  );

-- report_attendance
CREATE POLICY "Company contacts can view assigned report attendance"
  ON public.report_attendance FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_contact_report_ids(auth.uid()))
  );

-- report_deviations
CREATE POLICY "Company contacts can view assigned report deviations"
  ON public.report_deviations FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_contact_report_ids(auth.uid()))
  );

-- report_equipment
CREATE POLICY "Company contacts can view assigned report equipment"
  ON public.report_equipment FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_contact_report_ids(auth.uid()))
  );

-- report_photos
CREATE POLICY "Company contacts can view assigned report photos"
  ON public.report_photos FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_contact_report_ids(auth.uid()))
  );

-- report_signatures
CREATE POLICY "Company contacts can view assigned report signatures"
  ON public.report_signatures FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    report_id IN (SELECT get_contact_report_ids(auth.uid()))
  );

-- projects: allow company contacts to view projects from their reports
CREATE POLICY "Company contacts can view projects from assigned reports"
  ON public.projects FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    id IN (SELECT get_contact_project_ids(auth.uid()))
  );

-- companies: allow company contacts to view companies from their reports
CREATE POLICY "Company contacts can view companies from assigned reports"
  ON public.companies FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    id IN (
      SELECT p.company_id FROM public.projects p
      WHERE p.id IN (SELECT get_contact_project_ids(auth.uid()))
    )
  );

-- sites: allow company contacts to view sites from their reports
CREATE POLICY "Company contacts can view sites from assigned reports"
  ON public.sites FOR SELECT
  USING (
    is_company_contact(auth.uid()) AND
    id IN (
      SELECT p.site_id FROM public.projects p
      WHERE p.id IN (SELECT get_contact_project_ids(auth.uid()))
    )
  );
