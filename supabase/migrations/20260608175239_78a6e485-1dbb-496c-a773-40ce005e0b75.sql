
-- Add missing RLS policies for service_reports and child tables.
-- Only a SELECT policy existed, so every INSERT/UPDATE/DELETE failed with 42501.

-- Helper predicate reused below:
--   user belongs to the report's company OR is super_admin.

-- ============ service_reports ============
CREATE POLICY "Users can create service reports for their company"
  ON public.service_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update service reports from their company"
  ON public.service_reports
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Users can delete service reports from their company"
  ON public.service_reports
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin')
  );

-- ============ service_report_sections ============
CREATE POLICY "Users can view sections of accessible service reports"
  ON public.service_report_sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_reports sr
      WHERE sr.id = service_report_sections.report_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

CREATE POLICY "Users can insert sections in accessible service reports"
  ON public.service_report_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_reports sr
      WHERE sr.id = service_report_sections.report_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

CREATE POLICY "Users can update sections in accessible service reports"
  ON public.service_report_sections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_reports sr
      WHERE sr.id = service_report_sections.report_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_reports sr
      WHERE sr.id = service_report_sections.report_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

CREATE POLICY "Users can delete sections in accessible service reports"
  ON public.service_report_sections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_reports sr
      WHERE sr.id = service_report_sections.report_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

-- ============ service_report_photos ============
CREATE POLICY "Users can view photos of accessible service reports"
  ON public.service_report_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_report_sections s
      JOIN public.service_reports sr ON sr.id = s.report_id
      WHERE s.id = service_report_photos.section_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

CREATE POLICY "Users can insert photos in accessible service reports"
  ON public.service_report_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_report_sections s
      JOIN public.service_reports sr ON sr.id = s.report_id
      WHERE s.id = service_report_photos.section_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

CREATE POLICY "Users can update photos in accessible service reports"
  ON public.service_report_photos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_report_sections s
      JOIN public.service_reports sr ON sr.id = s.report_id
      WHERE s.id = service_report_photos.section_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_report_sections s
      JOIN public.service_reports sr ON sr.id = s.report_id
      WHERE s.id = service_report_photos.section_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

CREATE POLICY "Users can delete photos in accessible service reports"
  ON public.service_report_photos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_report_sections s
      JOIN public.service_reports sr ON sr.id = s.report_id
      WHERE s.id = service_report_photos.section_id
        AND (sr.company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
    )
  );

-- Ensure Data API grants are in place
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_reports        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_report_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_report_photos   TO authenticated;
GRANT ALL ON public.service_reports        TO service_role;
GRANT ALL ON public.service_report_sections TO service_role;
GRANT ALL ON public.service_report_photos   TO service_role;
