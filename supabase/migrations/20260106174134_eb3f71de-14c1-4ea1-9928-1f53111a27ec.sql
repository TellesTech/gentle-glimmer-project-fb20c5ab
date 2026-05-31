-- Remover política antiga
DROP POLICY IF EXISTS "Users can view company profiles" ON profiles;

-- Criar nova política com super_admin e leader
CREATE POLICY "Users can view company profiles" 
ON profiles 
FOR SELECT 
TO public
USING (
  (id = auth.uid()) OR 
  (company_id = get_user_company_id(auth.uid())) OR 
  has_role(auth.uid(), 'super_admin'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'director'::user_role) OR 
  has_role(auth.uid(), 'supervisor'::user_role) OR
  has_role(auth.uid(), 'leader'::user_role)
);