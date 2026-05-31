-- 1. Atualizar política DELETE na tabela reports
DROP POLICY IF EXISTS "Admin/Directors/Supervisors can delete reports" ON public.reports;
CREATE POLICY "Admin/Directors/Supervisors can delete reports" ON public.reports
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'director'::user_role) OR
  has_role(auth.uid(), 'supervisor'::user_role)
);

-- 2. Atualizar política ALL em report_activities
DROP POLICY IF EXISTS "Report creators can manage activities" ON public.report_activities;
CREATE POLICY "Report creators can manage activities" ON public.report_activities
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_activities.report_id
    AND (
      reports.created_by = auth.uid() OR
      has_role(auth.uid(), 'super_admin'::user_role) OR
      has_role(auth.uid(), 'admin'::user_role) OR
      has_role(auth.uid(), 'director'::user_role) OR
      has_role(auth.uid(), 'supervisor'::user_role) OR
      has_role(auth.uid(), 'leader'::user_role)
    )
  )
);

-- 3. Atualizar política ALL em report_attendance
DROP POLICY IF EXISTS "Report creators can manage attendance" ON public.report_attendance;
CREATE POLICY "Report creators can manage attendance" ON public.report_attendance
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_attendance.report_id
    AND (
      reports.created_by = auth.uid() OR
      has_role(auth.uid(), 'super_admin'::user_role) OR
      has_role(auth.uid(), 'admin'::user_role) OR
      has_role(auth.uid(), 'director'::user_role) OR
      has_role(auth.uid(), 'supervisor'::user_role) OR
      has_role(auth.uid(), 'leader'::user_role)
    )
  )
);

-- 4. Atualizar política ALL em report_deviations
DROP POLICY IF EXISTS "Report creators can manage deviations" ON public.report_deviations;
CREATE POLICY "Report creators can manage deviations" ON public.report_deviations
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_deviations.report_id
    AND (
      reports.created_by = auth.uid() OR
      has_role(auth.uid(), 'super_admin'::user_role) OR
      has_role(auth.uid(), 'admin'::user_role) OR
      has_role(auth.uid(), 'director'::user_role) OR
      has_role(auth.uid(), 'supervisor'::user_role) OR
      has_role(auth.uid(), 'leader'::user_role)
    )
  )
);

-- 5. Atualizar política ALL em report_photos
DROP POLICY IF EXISTS "Report creators can manage photos" ON public.report_photos;
CREATE POLICY "Report creators can manage photos" ON public.report_photos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_photos.report_id
    AND (
      reports.created_by = auth.uid() OR
      has_role(auth.uid(), 'super_admin'::user_role) OR
      has_role(auth.uid(), 'admin'::user_role) OR
      has_role(auth.uid(), 'director'::user_role) OR
      has_role(auth.uid(), 'supervisor'::user_role) OR
      has_role(auth.uid(), 'leader'::user_role)
    )
  )
);