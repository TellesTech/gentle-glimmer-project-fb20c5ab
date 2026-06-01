
-- 1. Lock down system_settings: drop broad SELECT, only admins can read full row.
DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;

CREATE POLICY "Admins can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

-- Public branding (safe, non-sensitive fields) exposed via SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.get_public_branding()
RETURNS TABLE (
  id uuid,
  logo_url text,
  pdf_logo_url text,
  login_logo_url text,
  favicon_url text,
  system_name text,
  system_subtitle text,
  primary_color text,
  accent_color text,
  ai_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, logo_url, pdf_logo_url, login_logo_url, favicon_url,
         system_name, system_subtitle, primary_color, accent_color, ai_avatar_url
  FROM public.system_settings
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_branding() TO anon, authenticated;

-- 2. Replace permissive "true" policies with role-scoped ones.
DROP POLICY IF EXISTS "Anyone can manage portal settings" ON public.client_portal_settings;
CREATE POLICY "Admins manage portal settings" ON public.client_portal_settings
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Authenticated can read portal settings" ON public.client_portal_settings
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can manage contact_sites" ON public.contact_sites;
CREATE POLICY "Admins manage contact_sites" ON public.contact_sites
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Contacts and admins can read contact_sites" ON public.contact_sites
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'super_admin')
  OR contact_id = get_company_contact_id(auth.uid())
);

DROP POLICY IF EXISTS "Anyone can manage daily workforce" ON public.project_daily_workforce;
CREATE POLICY "Managers manage daily workforce" ON public.project_daily_workforce
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'leader') OR has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'leader') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Company users can view daily workforce" ON public.project_daily_workforce
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_daily_workforce.project_id
  AND (p.company_id = get_user_company_id(auth.uid())
       OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director')
       OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'super_admin'))));

DROP POLICY IF EXISTS "Anyone can manage milestones" ON public.project_milestones;
CREATE POLICY "Managers manage milestones" ON public.project_milestones
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'leader') OR has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'leader') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Company users can view milestones" ON public.project_milestones
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_milestones.project_id
  AND (p.company_id = get_user_company_id(auth.uid())
       OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director')
       OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'super_admin'))));

-- 3. Fix mutable search_path on handle_new_user.
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

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'collaborator')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
