-- Políticas DELETE específicas para permitir administradores excluírem atividades

-- 1. Política DELETE específica para report_activities
DROP POLICY IF EXISTS "Admins can delete activities" ON public.report_activities;
CREATE POLICY "Admins can delete activities" ON public.report_activities
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'director'::user_role) OR
  has_role(auth.uid(), 'supervisor'::user_role) OR
  has_role(auth.uid(), 'leader'::user_role) OR
  EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_activities.report_id
    AND reports.created_by = auth.uid()
  )
);

-- 2. Política DELETE específica para report_attendance
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.report_attendance;
CREATE POLICY "Admins can delete attendance" ON public.report_attendance
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'director'::user_role) OR
  has_role(auth.uid(), 'supervisor'::user_role) OR
  has_role(auth.uid(), 'leader'::user_role) OR
  EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_attendance.report_id
    AND reports.created_by = auth.uid()
  )
);

-- 3. Política DELETE específica para report_deviations
DROP POLICY IF EXISTS "Admins can delete deviations" ON public.report_deviations;
CREATE POLICY "Admins can delete deviations" ON public.report_deviations
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'director'::user_role) OR
  has_role(auth.uid(), 'supervisor'::user_role) OR
  has_role(auth.uid(), 'leader'::user_role) OR
  EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_deviations.report_id
    AND reports.created_by = auth.uid()
  )
);

-- 4. Política DELETE específica para report_photos
DROP POLICY IF EXISTS "Admins can delete photos" ON public.report_photos;
CREATE POLICY "Admins can delete photos" ON public.report_photos
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'director'::user_role) OR
  has_role(auth.uid(), 'supervisor'::user_role) OR
  has_role(auth.uid(), 'leader'::user_role) OR
  EXISTS (
    SELECT 1 FROM public.reports
    WHERE reports.id = report_photos.report_id
    AND reports.created_by = auth.uid()
  )
);