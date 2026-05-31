
-- Helper: get report ids accessible to a client profile
CREATE OR REPLACE FUNCTION public.get_client_report_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT report_id FROM public.report_client_approvers
  WHERE client_id = get_client_profile_id(_user_id)
$$;

-- reports
CREATE POLICY "Client profiles can view assigned reports"
  ON public.reports FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    id IN (SELECT get_client_report_ids(auth.uid()))
  );

-- report_activities
CREATE POLICY "Client profiles can view assigned report activities"
  ON public.report_activities FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    report_id IN (SELECT get_client_report_ids(auth.uid()))
  );

-- report_attendance
CREATE POLICY "Client profiles can view assigned report attendance"
  ON public.report_attendance FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    report_id IN (SELECT get_client_report_ids(auth.uid()))
  );

-- report_deviations
CREATE POLICY "Client profiles can view assigned report deviations"
  ON public.report_deviations FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    report_id IN (SELECT get_client_report_ids(auth.uid()))
  );

-- report_equipment
CREATE POLICY "Client profiles can view assigned report equipment"
  ON public.report_equipment FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    report_id IN (SELECT get_client_report_ids(auth.uid()))
  );

-- report_photos
CREATE POLICY "Client profiles can view assigned report photos"
  ON public.report_photos FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    report_id IN (SELECT get_client_report_ids(auth.uid()))
  );

-- report_signatures
CREATE POLICY "Client profiles can view assigned report signatures"
  ON public.report_signatures FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    report_id IN (SELECT get_client_report_ids(auth.uid()))
  );

-- projects
CREATE POLICY "Client profiles can view related projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    id IN (SELECT get_client_project_ids(auth.uid()))
  );

-- companies
CREATE POLICY "Client profiles can view related companies"
  ON public.companies FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    id IN (SELECT p.company_id FROM public.projects p WHERE p.id IN (SELECT get_client_project_ids(auth.uid())))
  );

-- sites
CREATE POLICY "Client profiles can view related sites"
  ON public.sites FOR SELECT TO authenticated
  USING (
    is_client(auth.uid()) AND
    id IN (SELECT p.site_id FROM public.projects p WHERE p.id IN (SELECT get_client_project_ids(auth.uid())))
  );
