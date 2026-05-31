
DROP POLICY IF EXISTS "Users can view limited roles" ON public.user_roles;
CREATE POLICY "Users can view limited roles" ON public.user_roles
  FOR SELECT TO public
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'super_admin'::user_role)
    OR has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'director'::user_role)
    OR has_role(auth.uid(), 'supervisor'::user_role)
  );
