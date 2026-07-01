CREATE POLICY "Users can view their own portal access"
ON public.portal_admin_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());