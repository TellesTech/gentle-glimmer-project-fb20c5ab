
-- Add company_id, login_background_url, login_welcome_text to client_portal_settings
ALTER TABLE public.client_portal_settings 
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.client_portal_settings 
  ADD COLUMN IF NOT EXISTS login_background_url text,
  ADD COLUMN IF NOT EXISTS login_welcome_text text DEFAULT 'Acesse o portal da sua empresa';

ALTER TABLE public.client_portal_settings 
  ADD CONSTRAINT unique_company_portal_settings UNIQUE (company_id);

-- Add avatar_url and pin_hash to company_contacts
ALTER TABLE public.company_contacts 
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS pin_hash text;

-- Create a SECURITY DEFINER function to get company contacts for login (public, no auth needed)
CREATE OR REPLACE FUNCTION public.get_company_login_contacts(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  role text,
  avatar_url text,
  has_pin boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cc.id,
    cc.name,
    cc.email,
    cc.role,
    cc.avatar_url,
    (cc.pin_hash IS NOT NULL AND cc.pin_hash != '') AS has_pin
  FROM public.company_contacts cc
  WHERE cc.company_id = p_company_id 
    AND cc.is_active = true
    AND cc.user_id IS NOT NULL;
$$;

-- Create a SECURITY DEFINER function to get company portal settings without auth
CREATE OR REPLACE FUNCTION public.get_company_portal_settings(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  welcome_title text,
  welcome_subtitle text,
  client_logo_url text,
  client_primary_color text,
  client_accent_color text,
  login_background_url text,
  login_welcome_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cps.id,
    cps.company_id,
    cps.welcome_title,
    cps.welcome_subtitle,
    cps.client_logo_url,
    cps.client_primary_color,
    cps.client_accent_color,
    cps.login_background_url,
    cps.login_welcome_text
  FROM public.client_portal_settings cps
  WHERE cps.company_id = p_company_id
  LIMIT 1;
$$;

-- Also need to allow anonymous access to companies table for logo lookup
CREATE OR REPLACE FUNCTION public.get_company_public_info(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.logo_url
  FROM public.companies c
  WHERE c.id = p_company_id
  LIMIT 1;
$$;

-- Update RLS on client_portal_settings to allow reading by company_id for authenticated
-- Already has "Authenticated users can view" with USING(true), so it's fine

-- Add admin manage policy that includes admin role (not just super_admin)
DROP POLICY IF EXISTS "Admins can manage client portal settings" ON public.client_portal_settings;
CREATE POLICY "Admins can manage client portal settings"
ON public.client_portal_settings
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::user_role) 
  OR has_role(auth.uid(), 'admin'::user_role)
);
