-- Permitir que super_admin enxergue e gerencie reports (e tabelas relacionadas)
DROP POLICY IF EXISTS "Users can view related reports" ON public.reports;
CREATE POLICY "Users can view related reports"
ON public.reports
FOR SELECT
USING (
  (created_by = auth.uid())
  OR (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
  OR (project_id IN (
    SELECT projects.id FROM projects
    WHERE projects.company_id IN (
      SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()
    )
  ))
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

DROP POLICY IF EXISTS "Admin/Directors/Supervisors can delete reports" ON public.reports;
CREATE POLICY "Admin/Directors/Supervisors can delete reports"
ON public.reports
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);

DROP POLICY IF EXISTS "Creators and managers can update reports" ON public.reports;
CREATE POLICY "Creators and managers can update reports"
ON public.reports
FOR UPDATE
USING (
  (created_by = auth.uid())
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'director'::user_role)
  OR has_role(auth.uid(), 'supervisor'::user_role)
  OR has_role(auth.uid(), 'leader'::user_role)
  OR has_role(auth.uid(), 'super_admin'::user_role)
);