DROP POLICY IF EXISTS "Report creators can manage photos" ON public.report_photos;

CREATE POLICY "Users with report access can manage photos"
ON public.report_photos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_photos.report_id
      AND (
        r.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::user_role)
        OR public.has_role(auth.uid(), 'director'::user_role)
        OR public.has_role(auth.uid(), 'supervisor'::user_role)
        OR public.has_role(auth.uid(), 'leader'::user_role)
        OR public.has_role(auth.uid(), 'super_admin'::user_role)
        OR public.user_has_project_access(auth.uid(), r.project_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_photos.report_id
      AND (
        r.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::user_role)
        OR public.has_role(auth.uid(), 'director'::user_role)
        OR public.has_role(auth.uid(), 'supervisor'::user_role)
        OR public.has_role(auth.uid(), 'leader'::user_role)
        OR public.has_role(auth.uid(), 'super_admin'::user_role)
        OR public.user_has_project_access(auth.uid(), r.project_id)
      )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_photos TO authenticated;