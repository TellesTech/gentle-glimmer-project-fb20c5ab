-- ============================================
-- FIX 1: Create company-photos bucket with RLS
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-photos', 'company-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for company branding
CREATE POLICY "Public read company photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-photos');

-- Authenticated users can upload
CREATE POLICY "Authenticated upload company photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-photos');

-- Admins can update
CREATE POLICY "Admins update company photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-photos' AND (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'director'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  ));

-- Admins can delete
CREATE POLICY "Admins delete company photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-photos' AND (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'director'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  ));

-- ============================================
-- FIX 2: Restrict profiles table access
-- ============================================
DROP POLICY IF EXISTS "Users can view profiles for assignments" ON profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    company_id = get_user_company_id(auth.uid()) OR
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'director'::user_role) OR
    has_role(auth.uid(), 'supervisor'::user_role) OR
    has_role(auth.uid(), 'leader'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  );

-- ============================================
-- FIX 3: Protect owner info in system_settings
-- ============================================
DROP POLICY IF EXISTS "Leitura pública das configurações do sistema" ON system_settings;

-- Create a view for public branding (excludes owner info)
CREATE OR REPLACE VIEW public.public_system_branding AS
SELECT 
  id,
  system_name,
  system_subtitle,
  logo_url,
  login_logo_url,
  pdf_logo_url,
  favicon_url,
  primary_color,
  accent_color,
  ai_avatar_url
FROM system_settings
LIMIT 1;

-- Grant public access to the view
GRANT SELECT ON public.public_system_branding TO anon, authenticated;

-- Only admins can read full system_settings (including owner info)
CREATE POLICY "Admins can read all system settings"
  ON system_settings FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  );