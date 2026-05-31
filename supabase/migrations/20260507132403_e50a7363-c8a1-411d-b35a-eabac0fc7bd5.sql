DROP POLICY IF EXISTS "Creators and managers can update reports" ON public.reports;

CREATE POLICY "Creators and managers can update reports"
ON public.reports
FOR UPDATE
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
  OR has_role(auth.uid(), 'leader'::user_role)
);