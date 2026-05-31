
-- a) Remove admin role from company_contacts users (they're not real admins)
DELETE FROM public.user_roles 
WHERE role = 'admin'
AND user_id IN (
  SELECT user_id FROM public.company_contacts WHERE user_id IS NOT NULL
);

-- b) Update handle_new_user trigger to skip admin role for company contacts/clients
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  
  IF NOT EXISTS (SELECT 1 FROM public.company_contacts WHERE user_id = NEW.id OR email = NEW.email)
     AND COALESCE(NEW.raw_user_meta_data->>'is_client', 'false') != 'true'
  THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- c) Update RLS policy to exclude company_contacts and clients from admin-level access
DROP POLICY IF EXISTS "Users can view related reports" ON public.reports;

CREATE POLICY "Users can view related reports"
ON public.reports FOR SELECT TO authenticated
USING (
  (
    (
      has_role(auth.uid(), 'super_admin'::user_role)
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'supervisor'::user_role)
    )
    AND NOT is_company_contact(auth.uid())
    AND NOT is_client(auth.uid())
  )
  OR created_by = auth.uid()
  OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  OR project_id IN (
    SELECT id FROM projects WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  )
)
