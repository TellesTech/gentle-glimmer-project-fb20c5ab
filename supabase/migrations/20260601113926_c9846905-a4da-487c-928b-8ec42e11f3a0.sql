-- 1) client_profiles
DROP POLICY IF EXISTS "Anyone can insert client profile during registration" ON public.client_profiles;
CREATE POLICY "Authenticated users can create own client profile"
  ON public.client_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2) report_signatures
DROP POLICY IF EXISTS "Clients can insert signatures on assigned reports" ON public.report_signatures;
CREATE POLICY "Clients can insert signatures on assigned reports"
  ON public.report_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_client(auth.uid())
    AND report_id IN (
      SELECT rca.report_id
      FROM public.report_client_approvers rca
      WHERE rca.client_id = get_client_profile_id(auth.uid())
    )
  );

-- 3) system_settings
DROP POLICY IF EXISTS "Leitura pública das configurações do sistema" ON public.system_settings;
CREATE POLICY "Authenticated users can read system settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- 4) user_roles: restrictive INSERT policy
DROP POLICY IF EXISTS "Only admins can insert user roles" ON public.user_roles;
CREATE POLICY "Only admins can insert user roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'director'::user_role)
    OR has_role(auth.uid(), 'super_admin'::user_role)
  );

-- 5) storage.objects: scoped avatar uploads
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de avatares" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'admin'::user_role)
      OR has_role(auth.uid(), 'director'::user_role)
      OR has_role(auth.uid(), 'super_admin'::user_role)
    )
  );