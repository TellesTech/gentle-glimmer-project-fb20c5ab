-- Dropar a política existente de SELECT
DROP POLICY IF EXISTS "Users can view related reports" ON reports;

-- Recriar com super_admin incluído no início da lista
CREATE POLICY "Users can view related reports" ON reports
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'supervisor')
  OR (created_by = auth.uid())
  OR (team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ))
  OR (project_id IN (
    SELECT projects.id FROM projects 
    WHERE projects.company_id IN (
      SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()
    )
  ))
);