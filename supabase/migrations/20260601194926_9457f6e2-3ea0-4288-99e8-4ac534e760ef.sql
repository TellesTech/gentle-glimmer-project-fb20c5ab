-- Add super_admin to RLS read/manage policies for RDO child tables

-- report_photos
DROP POLICY IF EXISTS "Users can view related report photos" ON public.report_photos;
CREATE POLICY "Users can view related report photos" ON public.report_photos
FOR SELECT USING (
  EXISTS (SELECT 1 FROM reports r WHERE r.id = report_photos.report_id AND (
    r.created_by = auth.uid()
    OR r.team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR r.project_id IN (SELECT p.id FROM projects p WHERE p.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);
DROP POLICY IF EXISTS "Report creators can manage photos" ON public.report_photos;
CREATE POLICY "Report creators can manage photos" ON public.report_photos
FOR ALL USING (
  EXISTS (SELECT 1 FROM reports WHERE reports.id = report_photos.report_id AND (
    reports.created_by = auth.uid()
    OR has_role(auth.uid(),'admin'::user_role)
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'leader'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);

-- report_activities
DROP POLICY IF EXISTS "Users can view related report activities" ON public.report_activities;
CREATE POLICY "Users can view related report activities" ON public.report_activities
FOR SELECT USING (
  EXISTS (SELECT 1 FROM reports r WHERE r.id = report_activities.report_id AND (
    r.created_by = auth.uid()
    OR r.team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR r.project_id IN (SELECT p.id FROM projects p WHERE p.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);
DROP POLICY IF EXISTS "Report creators can manage activities" ON public.report_activities;
CREATE POLICY "Report creators can manage activities" ON public.report_activities
FOR ALL USING (
  EXISTS (SELECT 1 FROM reports WHERE reports.id = report_activities.report_id AND (
    reports.created_by = auth.uid()
    OR has_role(auth.uid(),'admin'::user_role)
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'leader'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);

-- report_attendance
DROP POLICY IF EXISTS "Users can view related report attendance" ON public.report_attendance;
CREATE POLICY "Users can view related report attendance" ON public.report_attendance
FOR SELECT USING (
  EXISTS (SELECT 1 FROM reports r WHERE r.id = report_attendance.report_id AND (
    r.created_by = auth.uid()
    OR r.team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR r.project_id IN (SELECT p.id FROM projects p WHERE p.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);
DROP POLICY IF EXISTS "Report creators can manage attendance" ON public.report_attendance;
CREATE POLICY "Report creators can manage attendance" ON public.report_attendance
FOR ALL USING (
  EXISTS (SELECT 1 FROM reports WHERE reports.id = report_attendance.report_id AND (
    reports.created_by = auth.uid()
    OR has_role(auth.uid(),'admin'::user_role)
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'leader'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);

-- report_deviations
DROP POLICY IF EXISTS "Users can view related report deviations" ON public.report_deviations;
CREATE POLICY "Users can view related report deviations" ON public.report_deviations
FOR SELECT USING (
  EXISTS (SELECT 1 FROM reports r WHERE r.id = report_deviations.report_id AND (
    r.created_by = auth.uid()
    OR r.team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR r.project_id IN (SELECT p.id FROM projects p WHERE p.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);
DROP POLICY IF EXISTS "Report creators can manage deviations" ON public.report_deviations;
CREATE POLICY "Report creators can manage deviations" ON public.report_deviations
FOR ALL USING (
  EXISTS (SELECT 1 FROM reports WHERE reports.id = report_deviations.report_id AND (
    reports.created_by = auth.uid()
    OR has_role(auth.uid(),'admin'::user_role)
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'leader'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);

-- report_equipment
DROP POLICY IF EXISTS "Users can view related report equipment" ON public.report_equipment;
CREATE POLICY "Users can view related report equipment" ON public.report_equipment
FOR SELECT USING (
  EXISTS (SELECT 1 FROM reports r WHERE r.id = report_equipment.report_id AND (
    r.created_by = auth.uid()
    OR r.team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR r.project_id IN (SELECT p.id FROM projects p WHERE p.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);
DROP POLICY IF EXISTS "Report creators can manage equipment" ON public.report_equipment;
CREATE POLICY "Report creators can manage equipment" ON public.report_equipment
FOR ALL USING (
  EXISTS (SELECT 1 FROM reports WHERE reports.id = report_equipment.report_id AND (
    reports.created_by = auth.uid()
    OR has_role(auth.uid(),'admin'::user_role)
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'leader'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);

-- report_signatures
DROP POLICY IF EXISTS "Users can view related report signatures" ON public.report_signatures;
CREATE POLICY "Users can view related report signatures" ON public.report_signatures
FOR SELECT USING (
  EXISTS (SELECT 1 FROM reports r WHERE r.id = report_signatures.report_id AND (
    r.created_by = auth.uid()
    OR r.team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR r.project_id IN (SELECT p.id FROM projects p WHERE p.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);
DROP POLICY IF EXISTS "Report creators can manage signatures" ON public.report_signatures;
CREATE POLICY "Report creators can manage signatures" ON public.report_signatures
FOR ALL USING (
  EXISTS (SELECT 1 FROM reports WHERE reports.id = report_signatures.report_id AND (
    reports.created_by = auth.uid()
    OR has_role(auth.uid(),'admin'::user_role)
    OR has_role(auth.uid(),'director'::user_role)
    OR has_role(auth.uid(),'supervisor'::user_role)
    OR has_role(auth.uid(),'leader'::user_role)
    OR has_role(auth.uid(),'super_admin'::user_role)
  ))
);
